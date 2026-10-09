import { useCallback, useEffect, useRef, useState } from "react";

import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  MeetingSessionConfiguration,
  LogLevel,
} from "amazon-chime-sdk-js";

import * as consultationsApi from "../api/consultations";

/**
 * Drives a one-to-one video meeting on the Amazon Chime SDK for EITHER
 * participant — the unified version of the hooks that used to be duplicated
 * in the client and expert portals. The caller's side (`user` or `expert`)
 * comes from the backend's `/join` response, resolved from the
 * authenticated token; nothing is inferred from the URL.
 *
 * The backend creates the Chime meeting and this participant's attendee;
 * this hook hands those credentials to the browser SDK, which connects
 * straight to AWS's media plane. No signaling, no polling for media — the
 * only API traffic is the join, a light liveness heartbeat, and the end.
 */
export function useMeeting(consultationId) {
  const [phase, setPhase] = useState("loading"); // loading | payment | connecting | live | ended | error
  const [error, setError] = useState("");
  const [side, setSide] = useState(null); // "user" | "expert" — from the backend
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [peerName, setPeerName] = useState("");
  // True once the OTHER participant is actually present in the meeting
  // (Chime attendee presence — fires even when their camera is off).
  // Powers the client's "expert didn't show up" no-show timer.
  const [remoteConnected, setRemoteConnected] = useState(false);

  const audioVideoRef = useRef(null);
  // The DefaultDeviceController created for this session — owns the raw
  // audio stream, so mic mute can hard-toggle `track.enabled` (the only
  // reliable way to mute on mobile web).
  const deviceControllerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const endedRef = useRef(false);
  // React StrictMode mounts effects twice in dev; two concurrent Chime
  // sessions fighting over the mic/camera break the local tile. Every run
  // takes an id — stale runs abort at each await point.
  const runIdRef = useRef(0);

  // Video elements the page hands us; tiles are bound as they appear.
  const localVideoElRef = useRef(null);
  const remoteVideoElRef = useRef(null);
  const localTileIdRef = useRef(null);
  const remoteTileIdRef = useRef(null);
  // Hidden audio element the remote stream plays through. Kept on a ref so
  // user gestures can (re)start playback — mobile autoplay policies require
  // a gesture, and the element must live in the DOM to play at all.
  const remoteAudioElRef = useRef(null);
  // Whether a user gesture has (or is expected to have) unlocked remote-audio
  // playback on this page — mobile autoplay policies need one.
  const audioUnlockedRef = useRef(false);
  // Local mic state must be tracked even when the SDK call fails (mobile
  // browsers occasionally reject mute toggles while the track is being
  // renegotiated), so the button never lies about what the user wanted.
  const micMutedRef = useRef(false);

  const stopEverything = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    setRemoteConnected(false);
    micMutedRef.current = false;
    try {
      deviceControllerRef.current?.stop?.();
    } catch {
      /* controller already destroyed */
    }
    deviceControllerRef.current = null;

    try {
      audioVideoRef.current?.stop();
    } catch {
      /* already stopped */
    }
    audioVideoRef.current = null;

    try {
      remoteAudioElRef.current?.remove();
    } catch {
      /* already gone */
    }
    remoteAudioElRef.current = null;
  }, []);

  /**
   * Play the remote-audio element, with a short bounded retry. Phone
   * browsers reject play() before a user gesture has "unlocked" them, but
   * the tap that joined the room usually counts, so a few delayed retries
   * land the sound without needing an explicit control press.
   *
   * iOS quirk: Safari sometimes doesn't attach the WebRTC audio track to
   * the element until play() is already running — pausing + replaying on
   * the first gesture forces it to pick the track up.
   */
  const playRemoteAudio = useCallback(() => {
    const el = remoteAudioElRef.current;
    if (!el) return;
    let tries = 0;
    const attempt = (delay) => {
      setTimeout(() => {
        const current = remoteAudioElRef.current;
        if (!current) return; // session torn down — stop retrying
        if (audioUnlockedRef.current && !current.paused && current.readyState > 2) {
          return; // already playing unmuted audio
        }
        current.play?.().catch(() => {
          tries += 1;
          if (tries < 6) attempt(500);
        });
      }, delay);
    };
    attempt(0);
    // iOS first-gesture nudge: reload the element so it binds the track.
    if (audioUnlockedRef.current) {
      try {
        el.load();
      } catch {
        /* load() failing is harmless — the attempt above covers playback */
      }
    }
  }, []);

  const finish = useCallback(
    async (endedRemotely = false) => {
      if (endedRef.current) return;
      endedRef.current = true;
      stopEverything();
      // Close the session server-side BEFORE showing the ended screen. The
      // meeting page navigates away as soon as the phase flips to "ended"
      // (the expert is sent to their dashboard), and a full page navigation
      // aborts an in-flight request — ending first is what actually closes
      // the peer's room.
      if (!endedRemotely) {
        try {
          await consultationsApi.endSession(consultationId);
        } catch {
          /* already closed server-side */
        }
      }
      setPhase("ended");
    },
    [consultationId, stopEverything],
  );

  // ------------------------------------------------------------------
  // In-session chat (Chime real-time data messages — transient,
  // delivered over the existing meeting connection, nothing stored).
  // ------------------------------------------------------------------

  const CHAT_TOPIC = "consultation-chat";

  const sendChatMessage = useCallback((text) => {
    const clean = String(text || "").trim().slice(0, 2000);
    if (!clean) return;

    const at = Date.now();
    const name = "You";

    // The sender never receives their own data message back — append it
    // locally so the chat feels immediate.
    setChatMessages((prev) => [
      ...prev.slice(-199),
      {
        id: `me-${at}-${Math.random().toString(36).slice(2, 8)}`,
        self: true,
        name,
        text: clean,
        at: new Date(at),
      },
    ]);

    try {
      audioVideoRef.current?.realtimeSendDataMessage(
        CHAT_TOPIC,
        JSON.stringify({ name, text: clean, at }),
        300000,
      );
    } catch {
      /* throttled or connection gone — the message stays local */
    }
  }, []);

  /**
   * Called by the page whenever a video element mounts. Tiles that showed
   * up earlier are bound on the spot, so elements and tiles can arrive in
   * either order.
   */
  const bindLocalVideo = useCallback((element) => {
    localVideoElRef.current = element;
    const audioVideo = audioVideoRef.current;
    if (element && audioVideo && localTileIdRef.current) {
      try {
        audioVideo.bindVideoElement(localTileIdRef.current, element);
      } catch {
        /* the tile will rebind on its next update */
      }
    }
  }, []);

  const bindRemoteVideo = useCallback((element) => {
    remoteVideoElRef.current = element;
    const audioVideo = audioVideoRef.current;
    if (element && audioVideo && remoteTileIdRef.current) {
      try {
        audioVideo.bindVideoElement(remoteTileIdRef.current, element);
        setPhase("live");
      } catch {
        /* the tile will rebind on its next update */
      }
    }
  }, []);

  // ------------------------------------------------------------------
  // Room entry (Chime session + backend join + heartbeat)
  // ------------------------------------------------------------------

  const startSessionFlow = useCallback(
    async (join, runId) => {
      const stale = () => runIdRef.current !== runId;

      setPhase("connecting");
      // The backend's /join payload resolves the caller from the token and
      // returns their role as `role` ("user" | "expert") — see the /join
      // controller (role: data.side). Nothing is inferred from the URL.
      setSide(join.role);
      setPeerName(join.role === "user" ? join.expertName || "" : join.userName || "");

      // Unpaid client: the backend holds the room keys until checkout —
      // the page sends them to the payment portal.
      if (join.paymentRequired) {
        setPhase("payment");
        return;
      }

      if (!join.meeting || !join.attendee) {
        setError("The meeting room is not ready yet. Please try again shortly.");
        setPhase("error");
        return;
      }

      // 1. Tell the backend we're in (the client's paid join:
      //    CONFIRMED → IN_PROGRESS).
      try {
        await consultationsApi.joinSession(consultationId);
        if (stale()) return;
      } catch (err) {
        if (stale()) return;
        setError(
          err.response?.data?.error?.message ||
            "Could not enter the session. It may have already ended.",
        );
        setPhase("error");
        return;
      }

      // 2. Build the Chime session from the backend's credentials.
      const logger = new ConsoleLogger("LifeBookz", LogLevel.WARN);
      const deviceController = new DefaultDeviceController(logger);
      // Kept in a ref so toggleMic can hard-gate the raw WebRTC audio
      // track (`track.enabled`) — the mute that mobile browsers respect.
      deviceControllerRef.current = deviceController;
      const configuration = new MeetingSessionConfiguration(
        join.meeting,
        join.attendee,
      );
      let meetingSession;
      try {
        meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);
      } catch (err) {
        setError(err.message || "Could not prepare the meeting session.");
        setPhase("error");
        return;
      }

      if (stale()) {
        try {
          meetingSession.audioVideo.stop();
        } catch {
          /* the newer run owns the devices now */
        }
        return;
      }

      const audioVideo = meetingSession.audioVideo;
      audioVideoRef.current = audioVideo;

      // Chat: messages arrive as real-time data messages on the meeting
      // connection itself.
      audioVideo.realtimeSubscribeToReceiveDataMessage(CHAT_TOPIC, (dataMessage) => {
        let payload = null;
        try {
          payload = JSON.parse(dataMessage.text());
        } catch {
          return;
        }
        if (!payload?.text) return;
        setChatMessages((prev) => [
          ...prev.slice(-199),
          {
            id: `${dataMessage.senderAttendeeId}-${dataMessage.timestampMs}`,
            self: false,
            name: payload.name || (join.role === "user" ? "Expert" : "Client"),
            text: String(payload.text).slice(0, 2000),
            at: new Date(payload.at || dataMessage.timestampMs || Date.now()),
          },
        ]);
      });

      audioVideo.addObserver({
        audioVideoDidStart: () => {
          setPhase((p) => (p === "connecting" ? "live" : p));
          // Reconnect path: the meeting reconnected and playback stopped —
          // resume remote audio automatically.
          playRemoteAudio();
        },
        audioVideoDidStop: () => {
          // The meeting ended — the peer hung up or the session closed.
          if (!endedRef.current) finish(true);
        },
        videoTileDidUpdate: (tile) => {
          if (endedRef.current || !tile?.tileId) return;
          // The SDK's tile state flag is `localTile` (NOT `isLocal`) —
          // misreading it routes both tiles to the same element and shows
          // only one video.
          if (tile.localTile) {
            localTileIdRef.current = tile.tileId;
            if (localVideoElRef.current) {
              try {
                audioVideo.bindVideoElement(tile.tileId, localVideoElRef.current);
              } catch {
                /* rebound on the next tile update */
              }
            }
          } else {
            remoteTileIdRef.current = tile.tileId;
            setRemoteVideoOn(true);
            if (remoteVideoElRef.current) {
              try {
                audioVideo.bindVideoElement(tile.tileId, remoteVideoElRef.current);
                setPhase("live");
              } catch {
                /* rebound on the next tile update */
              }
            }
          }
        },
        videoTileWasRemoved: (tile) => {
          if (!tile?.localTile) setRemoteVideoOn(false);
        },
      });

      // Attendee presence — the reliable "is the other side actually in the
      // room" signal (works even with their camera off and before any tile
      // exists). The local attendee is filtered out by id.
      try {
        const localAttendeeId = audioVideo.localAttendeeId();
        audioVideo.realtimeSubscribeToAttendeeIdPresence(
          (attendeeId, present) => {
            if (!attendeeId || attendeeId === localAttendeeId) return;
            setRemoteConnected(present);
          },
        );
      } catch {
        /* presence unavailable — the no-show timer just stays off */
      }

      // Remote audio plays through a dedicated hidden audio element. On
      // phone browsers the element must be attached to the DOM, carry
      // playsinline, and be started from a user gesture — otherwise the
      // autoplay policy keeps it silent and mute/unmute feel broken.
      try {
        const audioEl = document.createElement("audio");
        audioEl.setAttribute("autoplay", "");
        audioEl.setAttribute("playsinline", "");
        audioEl.style.display = "none";
        document.body.appendChild(audioEl);
        remoteAudioElRef.current = audioEl;
        audioVideo.bindAudioElement(audioEl);
      } catch {
        /* audio falls back to the remote video element if binding fails */
      }
      // Try to start playback right away — the tap that joined the room
      // usually counts as a gesture, and delayed retries mop up whatever
      // the autoplay policy still blocks.
      playRemoteAudio();

      // 3. Heartbeat keeps the session alive server-side.
      heartbeatRef.current = setInterval(() => {
        consultationsApi.heartbeat(consultationId).catch(() => {});
      }, 15000);

      // 4. Acquire the devices — this is what actually triggers the
      // browser's mic/camera permission prompts (start() alone never
      // touches the hardware) — and then connect.
      try {
        const audioInputs = await audioVideo.listAudioInputDevices();
        await audioVideo.startAudioInput(audioInputs[0]?.deviceId ?? null);
        if (stale()) return;
      } catch {
        setError("Microphone access is required for the session.");
        setPhase("error");
        return;
      }

      let videoOn = true;
      try {
        const videoInputs = await audioVideo.listVideoInputDevices();
        if (videoInputs.length) {
          await audioVideo.startVideoInput(videoInputs[0]?.deviceId ?? null);
          if (stale()) return;
        } else {
          videoOn = false;
          setCameraOn(false);
        }
      } catch {
        // No camera is not fatal — the session continues audio-only.
        videoOn = false;
        setCameraOn(false);
      }

      try {
        await audioVideo.start();
        if (stale()) return;
        if (videoOn) audioVideo.startLocalVideoTile();
      } catch {
        setError("Could not connect to the meeting. Please try again.");
        setPhase("error");
      }
    },
    [consultationId, finish],
  );

  useEffect(() => {
    let cancelled = false;
    const runId = ++runIdRef.current;
    endedRef.current = false;
    localTileIdRef.current = null;
    remoteTileIdRef.current = null;
    setChatMessages([]);
    setRemoteVideoOn(false);
    setRemoteConnected(false);
    setPhase("loading");

    (async () => {
      try {
        // Authorize + fetch the Chime credentials in one call. The backend
        // checks: authenticated → consultation exists → caller is the
        // assigned client or expert → consultation is joinable. An
        // unauthorized visitor to this URL simply gets an error here.
        const join = await consultationsApi.joinConsultation(consultationId);
        if (cancelled) return;

        await startSessionFlow(join, runId);
      } catch (err) {
        if (cancelled) return;
        setError(
          err.response?.data?.error?.message ||
            err.message ||
            "Could not start the session.",
        );
        setPhase("error");
      }
    })();

    // Leaving the page (refresh, navigating away) must NOT end the meeting —
    // the session closes only when someone explicitly hangs up, the peer
    // ends it, or the server's stale-session sweep closes it.
    //
    // StrictMode's first mount is the exception: it stops ITS OWN session
    // (this run's audioVideo was still the ref value at cleanup time) and
    // bumps the run id so the second mount owns the devices cleanly.
    return () => {
      cancelled = true;
      const wasCurrentRun = runIdRef.current === runId;
      if (wasCurrentRun) {
        endedRef.current = true;
        stopEverything();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  // ------------------------------------------------------------------
  // A user gesture unlocks remote-audio playback on restrictive mobile
  // browsers, so a first tap anywhere on the page re-kicks playback.
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      const el = remoteAudioElRef.current;
      el?.play?.().catch(() => {});
    };
    window.addEventListener("pointerdown", unlockAudio, { once: false });
    window.addEventListener("touchstart", unlockAudio, { once: false });
    window.addEventListener("keydown", unlockAudio, { once: false });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // Controls
  // ------------------------------------------------------------------

  /**
   * Mute / unmute the local mic. Two layers, because mobile browsers are
   * unreliable with either alone:
   *   1. the SDK's realtime mute (its canonical state + data-channel
   *      presence),
   *   2. the raw WebRTC track's enabled flag (the actual media — some
   *      Android/iOS browsers ignore the SDK's mute while renegotiating).
   * Both must agree or the far side hears either silence that won't
   * un-mute, or audio that won't mute.
   */
  const toggleMic = useCallback(() => {
    const audioVideo = audioVideoRef.current;
    if (!audioVideo) return;

    const nextMuted = !micMutedRef.current;

    // Layer 1: the SDK's canonical mute. The facade's realtimeMute* only
    // flips the signaling state; DefaultDeviceController actually gates the
    // audio stream — and on mobile browsers that's the part that fails, so
    // we drive BOTH.
    try {
      if (nextMuted) {
        if (!audioVideo.realtimeIsLocalAudioMuted()) {
          audioVideo.realtimeMuteLocalAudio();
        }
      } else if (audioVideo.realtimeIsLocalAudioMuted()) {
        audioVideo.realtimeUnmuteLocalAudio();
      }
    } catch {
      /* keep going — the optimistic state below keeps the UI truthful */
    }

    // Layer 2: the raw WebRTC track's enabled flag — the actual media. Some
    // Android/iOS browsers ignore the SDK's mute signaling while the stream
    // is being renegotiated, so the far side keeps hearing (or never hears)
    // the mic. Setting `enabled` is the WebRTC-standard hard mute that
    // always works.
    try {
      const stream =
        deviceControllerRef.current?.intrinsicDeviceAsMediaStream?.();
      stream
        ?.getAudioTracks?.()
        .forEach((track) => {
          track.enabled = !nextMuted;
        });
    } catch {
      /* intrinsicDeviceAsMediaStream may be absent on some SDK versions */
    }

    micMutedRef.current = nextMuted;
    setMicOn(!nextMuted);

    // A tap is a user gesture: the one moment mobile autoplay policies allow
    // (re)starting remote audio playback.
    playRemoteAudio();
  }, [playRemoteAudio]);

  const toggleCamera = useCallback(async () => {
    const audioVideo = audioVideoRef.current;
    if (!audioVideo) return;
    // A tap is a user gesture: the one moment mobile autoplay policies allow
    // (re)starting remote audio playback.
    playRemoteAudio();
    if (cameraOn) {
      audioVideo.stopLocalVideoTile();
      await audioVideo.stopVideoInput();
      setCameraOn(false);
    } else {
      try {
        const videoInputs = await audioVideo.listVideoInputDevices();
        await audioVideo.startVideoInput(videoInputs[0]?.deviceId ?? null);
        audioVideo.startLocalVideoTile();
        setCameraOn(true);
      } catch {
        setCameraOn(false);
      }
    }    }, [cameraOn, playRemoteAudio]);

  const hangUp = useCallback(() => finish(false), [finish]);

  return {
    phase,
    error,
    side,
    bindLocalVideo,
    bindRemoteVideo,
    micOn,
    cameraOn,
    remoteVideoOn,
    remoteConnected,
    toggleMic,
    toggleCamera,
    hangUp,
    chatMessages,
    peerName,
    sendChatMessage,
  };
}
