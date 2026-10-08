import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import Logo from "../components/Logo";
import VideoStage from "../components/VideoStage";
import ControlBar from "../components/ControlBar";
import ChatPanel from "../components/ChatPanel";
import PhaseMessage, { Icon } from "../components/PhaseMessage";
import { Paths } from "../components/Icons";
import { useMeeting } from "../hooks/useMeeting";
import * as consultationsApi from "../api/consultations";

/** Grace window before an absent expert's booking is cancelled. */
const NO_SHOW_GRACE_MS = 5 * 60 * 1000;

/**
 * The live meeting room — the one page both clients and experts share.
 *
 * Identity, authorization and the Chime credentials all come from the
 * backend (`/consultations/:id/join`); the URL alone grants nothing.
 *
 * When the meeting ends the two sides part ways:
 *  - the expert is returned to their dashboard,
 *  - the client who opened the room from the mobile app (`?src=lifebookz`)
 *    is sent straight back into the app's own rating screen,
 *  - every other client goes to this portal's web rating page.
 */
export default function MeetingPage() {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const meeting = useMeeting(consultationId);

  // Which surface opened this room: ?platform=mobile (the LifeBookz app's
  // in-app browser) or ?platform=web / absent (a desktop/mobile browser).
  // Persisted per tab so in-portal navigations (payment hops, the rating
  // page) keep the knowledge even when the query string is dropped.
  const rawPlatform = (searchParams.get("platform") || "").toLowerCase();
  let platform = rawPlatform === "mobile" || rawPlatform === "web" ? rawPlatform : "";
  try {
    if (platform) {
      sessionStorage.setItem("lbz_platform", platform);
    } else {
      platform = sessionStorage.getItem("lbz_platform") || "";
    }
  } catch {
    /* storage unavailable — the query param alone still works */
  }
  const isMobileApp = platform === "mobile";

  const [chatOpen, setChatOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);

  // ------------------------------------------------------------------
  // No-show protection (client side only)
  // ------------------------------------------------------------------
  // Industry-standard grace window: if the expert hasn't actually entered
  // the room within 5 minutes of the client being live, the booking is
  // cancelled automatically and the client is apologised to + redirected
  // to book a new expert.
  const [noShowLeft, setNoShowLeft] = useState(null); // seconds remaining
  const [noShow, setNoShow] = useState(false); // apology screen

  // Unread badge: anything that arrived while the panel was closed.
  useEffect(() => {
    if (chatOpen) setSeenCount(meeting.chatMessages.length);
  }, [chatOpen, meeting.chatMessages.length]);

  const unread = Math.max(0, meeting.chatMessages.length - seenCount);
  const isExpert = meeting.side === "expert";

  const noShowDeadlineRef = useRef(null);
  useEffect(() => {
    if (isExpert || meeting.phase !== "live" || meeting.remoteConnected) {
      noShowDeadlineRef.current = null;
      setNoShowLeft(null);
      return undefined;
    }
    if (noShowDeadlineRef.current) return undefined; // timer already running
    noShowDeadlineRef.current = Date.now() + NO_SHOW_GRACE_MS;
    setNoShowLeft(Math.round(NO_SHOW_GRACE_MS / 1000));
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.round((noShowDeadlineRef.current - Date.now()) / 1000),
      );
      setNoShowLeft(left);
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [isExpert, meeting.phase, meeting.remoteConnected]);

  // Grace window expired without the expert → cancel + apologise.
  useEffect(() => {
    if (noShowLeft !== 0 || isExpert || meeting.remoteConnected || noShow) return;
    let cancelled = false;
    (async () => {
      setNoShowCancelling(true);
      try {
        await consultationsApi.cancelConsultation(consultationId, "Expert no-show");
      } catch {
        /* the apology screen shows either way */
      }
      if (!cancelled) {
        setNoShow(true);
        // Tear the room down (stops mic/camera + heartbeat); the apology
        // screen above takes precedence over the plain ended screen.
        meeting.hangUp();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noShowLeft, isExpert, meeting.remoteConnected, noShow, consultationId]);

  // ------------------------------------------------------------------
  // Exit routing
  // ------------------------------------------------------------------

  const sendToPaymentPortal = useMemo(
    () => async () => {
      const paymentBase = (import.meta.env.VITE_PAYMENT_URL || "").replace(/\/$/, "");
      if (!paymentBase) return;

      // Mint a fresh one-time ticket so the checkout opens already
      // signed-in as this user. The platform marker rides along so the
      // payment portal forwards it to the room it opens after checkout.
      try {
        const code = await consultationsApi.mintHandoffTicket();
        const platformParam = isMobileApp ? "?platform=mobile" : "";
        window.location.href = `${paymentBase}/pay/consultation/${consultationId}${platformParam}#tk=${code}`;
      } catch {
        /* fall through to the error state */
      }
      return true;
    },
    [consultationId, isMobileApp],
  );

  // Post-meeting routing, per side.
  useEffect(() => {
    if (meeting.phase !== "ended") return;

    if (isExpert) {
      // Expert's job is done — back to the dashboard.
      const expertBase = (import.meta.env.VITE_EXPERT_URL || "").replace(/\/$/, "");
      if (expertBase) {
        window.location.href = `${expertBase}/dashboard`;
      }
      return;
    }

    // Mobile-app client (?platform=mobile): rating happens INSIDE the app —
    // bounce them back with the consultation id so the app opens its own
    // rating screen. The web rating page is never shown on mobile.
    if (isMobileApp) {
      window.location.href = `lifebookz://consult/rate?consultationId=${encodeURIComponent(
        consultationId,
      )}`;
      return;
    }

    // The client is asked to rate the meeting (and the expert) here.
    navigate(`/rating/${consultationId}`, { replace: true });
  }, [meeting.phase, isExpert, consultationId, navigate, isMobileApp]);

  // ------------------------------------------------------------------
  // Phase screens
  // ------------------------------------------------------------------

  // Expert never showed up — the booking was cancelled automatically.
  if (noShow) {
    const clientBase = (import.meta.env.VITE_CLIENT_URL || "").replace(/\/$/, "");
    return (
      <PhaseMessage
        icon={<Icon path={Paths.clock} className="h-8 w-8" />}
        title="We're really sorry"
        action={
          isMobileApp
            ? { href: "lifebookz://bookings", label: "Back to the app" }
            : undefined
        }
      >
        <p>
          Your expert didn't join within 5 minutes, so this session was
          cancelled automatically — you won't be charged for it.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {clientBase && (
            <a
              href={`${clientBase}/consult`}
              className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Book a new session
            </a>
          )}
          {clientBase && (
            <a
              href={`${clientBase}/bookings`}
              className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              Back to My Bookings
            </a>
          )}
        </div>
      </PhaseMessage>
    );
  }

  if (meeting.phase === "loading") {
    return (
      <PhaseMessage
        icon={<Icon path={Paths.infoCircle} className="h-8 w-8 animate-spin" />}
        title="Preparing your room…"
      >
        Checking the consultation and getting things ready.
      </PhaseMessage>
    );
  }

  // Unpaid client: the backend holds the room keys until checkout —
  // bounce to the payment portal, signed in via a fresh one-time ticket.
  if (meeting.phase === "payment") {
    sendToPaymentPortal();
    return (
      <PhaseMessage
        icon={<Icon path={Paths.lock} className="h-8 w-8" />}
        title="One step left"
      >
        Taking you to secure checkout…
      </PhaseMessage>
    );
  }

  if (meeting.phase === "error") {
    const expertBase = (import.meta.env.VITE_EXPERT_URL || "").replace(/\/$/, "");
    const clientBase = (import.meta.env.VITE_CLIENT_URL || "").replace(/\/$/, "");

    return (
      <PhaseMessage
        icon={<Icon path={Paths.infoCircle} className="h-8 w-8" />}
        title="Session unavailable"
        action={
          isExpert
            ? expertBase && { href: `${expertBase}/dashboard`, label: "Back to Dashboard" }
            : clientBase && { href: `${clientBase}/bookings`, label: "Back to My Bookings" }
        }
      >
        {meeting.error ||
          "This session can't be opened. It may not be confirmed yet, or it has already ended."}
      </PhaseMessage>
    );
  }

  if (meeting.phase === "ended") {
    const backToApp = !isExpert && isMobileApp;
    return (
      <PhaseMessage
        icon={<Icon path={Paths.infoCircle} className="h-8 w-8 animate-spin" />}
        title="Session ended"
        action={
          backToApp
            ? {
                href: `lifebookz://consult/rate?consultationId=${encodeURIComponent(consultationId)}`,
                label: "Return to the app",
              }
            : undefined
        }
      >
        {isExpert
          ? "Returning to your dashboard…"
          : backToApp
            ? "Tap the button below if the app doesn't open by itself."
            : "One moment — we'd love your feedback…"}
      </PhaseMessage>
    );
  }

  const connecting = meeting.phase === "connecting";
  const peerLabel = isExpert ? "client" : "expert";
  const peerTileLabel = meeting.peerName || (isExpert ? "Client" : "Expert");

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="flex items-center justify-center border-b border-border/60 bg-card/60 px-4 py-3">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
        <VideoStage
          bindLocalVideo={meeting.bindLocalVideo}
          bindRemoteVideo={meeting.bindRemoteVideo}
          peerLabel={peerLabel}
          peerTileLabel={peerTileLabel}
          cameraOn={meeting.cameraOn}
          remoteVideoOn={meeting.remoteVideoOn}
          connecting={connecting}
          connectingTitle={
            isExpert
              ? "Waiting for your client to connect…"
              : "Waiting for your expert to connect…"
          }
        />

        {/* No-show countdown — visible to the client while they wait alone */}
        {!isExpert && noShowLeft != null && (
          <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Icon path={Paths.clock} className="h-4 w-4" />
            {noShowLeft > 0
              ? `Your expert hasn't joined yet — this session will be cancelled in ${Math.floor(noShowLeft / 60)}:${String(noShowLeft % 60).padStart(2, "0")}`
              : "Cancelling this session…"}
          </p>
        )}

        <ControlBar
          micOn={meeting.micOn}
          cameraOn={meeting.cameraOn}
          toggleMic={meeting.toggleMic}
          toggleCamera={meeting.toggleCamera}
          onToggleChat={() => setChatOpen((open) => !open)}
          unread={unread}
          isExpert={isExpert}
          onEnd={meeting.hangUp}
        />
      </main>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={meeting.chatMessages}
        onSend={meeting.sendChatMessage}
        peerLabel={`your ${peerLabel}`}
      />
    </div>
  );
}
