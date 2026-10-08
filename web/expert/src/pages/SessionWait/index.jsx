import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import useRealtimeConsultations from "../../hooks/useRealtimeConsultations";
import * as consultApi from "../../api/consultation";
import { openConsultation } from "../../utils/handoff";
import LoadingScreen from "../../components/common/LoadingScreen";
import Button from "../../components/ui/Button";
import { Icons } from "../../icons";
import { formatDate } from "../../utils/helpers";

/**
 * Live waiting room — the page an expert lands on the moment they confirm
 * a request. Mirrors the client's own waiting screen so both sides see the
 * same kind of experience:
 *
 *   CONFIRMED   → "Please wait while your client joins…" (WS + 5s poll)
 *   IN_PROGRESS → "Your client has joined — Join now!"
 *   COMPLETED   → session over, back to the dashboard
 *   CANCELLED / EXPIRED → the session fell through, back to the dashboard
 *
 * Live updates arrive over the WebSocket (subscribe by consultationId —
 * now pushed directly by the backend's session/join + end Lambdas); the
 * poll is only a safety net.
 */
const POLL_INTERVAL_MS = 5_000;

export default function SessionWait() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { expert } = useAuth();

  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await consultApi.getConsultation(id);
      setConsultation(data);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "We couldn't load this session. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Poll while the client is still on their way (paying).
  useEffect(() => {
    load();
    if (!id) return undefined;
    const interval = setInterval(() => {
      const status = consultation?.status;
      if (status && !["CONFIRMED", "PENDING"].includes(status)) return;
      if (document.visibilityState === "visible") load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load]);

  // WebSocket: any event for this consultation refetches instantly.
  const expertId = expert?._id || expert?.id;
  const { subscribe } = useRealtimeConsultations((event) => {
    const frameId = event.consultationId || event.consultation?._id || event.consultation?.id;
    if (!event || event.event === "ping" || frameId !== id) return;
    load();
  }, expertId);

  useEffect(() => {
    if (id && subscribe) subscribe(id);
  }, [id, subscribe]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await openConsultation(id);
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message ||
          err.message ||
          "Could not open the session room. Please try again.",
      );
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <LoadingScreen message="Opening your session tracker…" />;

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={load}>Try again</Button>
          <Link to="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!consultation) return null;

  const status = consultation.status;
  const clientName = consultation.user?.fullName || "Your client";

  let badge = { tone: "info", label: "Confirmed" };
  let title = "Please wait while your client joins…";
  let body = `You confirmed ${clientName}'s session. Keep this page open — the moment your client enters the room, the Join button appears right here.`;

  if (status === "IN_PROGRESS") {
    badge = { tone: "success", label: "Client is in the room" };
    title = `${clientName} has joined — join now!`;
    body = "Your client is waiting for you in the live room. Tap Join session to start.";
  } else  if (status === "COMPLETED") {
    badge = { tone: "default", label: "Completed" };
    title = "Session completed";
    body = "This session has finished. Thanks for showing up for your client.";
  } else if (["CANCELLED", "EXPIRED"].includes(status)) {
    badge = { tone: "danger", label: status === "CANCELLED" ? "Cancelled" : "Expired" };
    title = "This session was cancelled";
    body = "The client cancelled this session (or it expired). Nothing more to do here.";
  }

  const showJoin = status === "IN_PROGRESS";
  const live = ["CONFIRMED", "IN_PROGRESS"].includes(status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icons.arrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl ${
            showJoin ? "bg-success/10" : "bg-primary/10"
          }`}
        >
          {showJoin ? (
            <span className="relative flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-success" />
            </span>
          ) : live ? (
            // Waiting: same spinner language the client's room uses.
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
          ) : (
            <Icons.infoCircle className="h-10 w-10 text-muted-foreground" />
          )}
        </div>

        <span
          className={`mt-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
            showJoin
              ? "border-success/30 bg-success/10 text-success"
              : "border-border bg-muted/40 text-muted-foreground"
          }`}
        >
          {badge.label}
        </span>

        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          {consultation.problem
            ? `“${consultation.problem}”`
            : ""}
          {consultation.createdAt ? ` · Requested ${formatDate(consultation.createdAt)}` : ""}
        </p>

        {live && (
          <div className="mt-8">
            {showJoin ? (
              <Button
                size="lg"
                variant="success"
                onClick={handleJoin}
                loading={joining}
                icon={<Icons.videoCamera className="h-4 w-4" />}
              >
                Join session now
              </Button>
            ) : (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icons.clock className="h-4 w-4 animate-pulse" />
                We'll alert you the moment they're in — keep this page open.
              </p>
            )}
          </div>
        )}

        {status === "COMPLETED" && (
          <div className="mt-8">
            <Link to="/dashboard">
              <Button size="lg">Back to Dashboard</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
