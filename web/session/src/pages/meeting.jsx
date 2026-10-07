import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Logo from "../components/Logo";
import VideoStage from "../components/VideoStage";
import ControlBar from "../components/ControlBar";
import ChatPanel from "../components/ChatPanel";
import PhaseMessage, { Icon } from "../components/PhaseMessage";
import { Paths } from "../components/Icons";
import { useMeeting } from "../hooks/useMeeting";
import * as consultationsApi from "../api/consultations";

/**
 * The live meeting room — the one page both clients and experts share.
 *
 * Identity, authorization and the Chime credentials all come from the
 * backend (`/consultations/:id/join`); the URL alone grants nothing.
 *
 * When the meeting ends the two sides part ways, exactly as before:
 *  - the expert is returned to their dashboard,
 *  - the client is taken to this portal's rating page.
 */
export default function MeetingPage() {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const meeting = useMeeting(consultationId);

  const [chatOpen, setChatOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);

  // Unread badge: anything that arrived while the panel was closed.
  useEffect(() => {
    if (chatOpen) setSeenCount(meeting.chatMessages.length);
  }, [chatOpen, meeting.chatMessages.length]);

  const unread = Math.max(0, meeting.chatMessages.length - seenCount);
  const isExpert = meeting.side === "expert";

  // ------------------------------------------------------------------
  // Exit routing
  // ------------------------------------------------------------------

  const sendToPaymentPortal = useMemo(
    () => async () => {
      const paymentBase = (import.meta.env.VITE_PAYMENT_URL || "").replace(/\/$/, "");
      if (!paymentBase) return;

      // Mint a fresh one-time ticket so the checkout opens already
      // signed-in as this user.
      try {
        const code = await consultationsApi.mintHandoffTicket();
        window.location.href = `${paymentBase}/pay/consultation/${consultationId}#tk=${code}`;
      } catch {
        /* fall through to the error state */
      }
      return true;
    },
    [consultationId],
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

    // The client is asked to rate the meeting (and the expert) here.
    navigate(`/rating/${consultationId}`, { replace: true });
  }, [meeting.phase, isExpert, consultationId, navigate]);

  // ------------------------------------------------------------------
  // Phase screens
  // ------------------------------------------------------------------

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
    return (
      <PhaseMessage
        icon={<Icon path={Paths.infoCircle} className="h-8 w-8 animate-spin" />}
        title="Session ended"
      >
        {isExpert ? "Returning to your dashboard…" : "One moment — we'd love your feedback…"}
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
