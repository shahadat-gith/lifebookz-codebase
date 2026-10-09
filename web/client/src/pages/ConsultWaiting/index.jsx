/**
 * Waiting for expert confirmation — shown right after a booking request is
 * sent. Live updates arrive over the AWS API Gateway WebSocket
 * (consultation.confirmed / .cancelled); a lightweight polling fallback
 * covers WS outage.
 *
 * The wait is bounded:
 *   • 2 min  — a dismissible "Getting late?" modal offers to book a
 *              different expert instead.
 *   • 5 min  — the request is cancelled automatically ("Expert did not
 *              confirm") and the user is pointed to book a new expert.
 * "Book a new expert" always cancels the pending request first — nothing
 * is left dangling.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { Icons } from "../../icons";
import { cancel, getConsultation } from "../../api/consultation";
import { useConsultationEvents } from "../../api/realtime";
import { openPayment } from "../../utils/handoff";
import { initials } from "../MyBookings/utils";

const POLL_INTERVAL_MS = 20_000; // WS-fallback net
const NUDGE_MS = 2 * 60_000; // "Getting late?" modal after this
const MAX_WAIT_MS = 5 * 60_000; // server cancels the booking here; mirror it
const FALLBACK_DEADLINE_MS = MAX_WAIT_MS; // when the payload has no deadline yet

/**
 * The expert's avatar with two pulsing rings animating outward while we
 * wait; the rings stop once the session is confirmed.
 */
function AvatarWithRings({ avatarUrl, name, confirmed }) {
  return (
    <div className="relative flex h-[150px] w-[150px] items-center justify-center">
      {!confirmed &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute h-[110px] w-[110px] rounded-full border-2 border-primary"
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.9 }}
            transition={{
              duration: 2.2,
              delay: i * 0.9,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        ))}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-[84px] w-[84px] rounded-full object-cover ring-4 ring-primary/15"
        />
      ) : (
        <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-primary font-display text-xl font-extrabold text-primary-foreground ring-4 ring-primary/15">
          {initials(name)}
        </div>
      )}
    </div>
  );
}

/**
 * "Getting late?" — after two minutes without a confirmation, a wide,
 * closable modal offers to book a different expert. The X and the dismiss
 * path both keep waiting; the only forced path is the 5-minute expiry.
 */
function GettingLateModal({ expertName, onDismiss, onBookOther }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Still waiting"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-border/70 bg-card p-8 shadow-xl">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icons.close className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Icons.clock className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              Getting late?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {expertName} hasn&apos;t responded yet. You can keep waiting —
              we&apos;ll notify you the moment there&apos;s an update — or book
              a different expert right away.
            </p>
            <button
              type="button"
              onClick={onBookOther}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              <Icons.search className="h-4 w-4" />
              Book a new expert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The 5-minute expiry screen: the request was cancelled automatically and
 * the user is asked to book a different expert. "Book a new expert" cancels
 * the pending request first (idempotent — cancelling an already-cancelled
 * request is safe), then opens the expert search.
 */
function ExpiredScreen({ expertName, onCancelAndBook, onBookings, cancelling }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <Icons.clock className="h-7 w-7" />
      </span>

      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
        Request not confirmed
      </h1>
      <p className="max-w-md text-sm leading-6 text-muted-foreground md:text-base">
        {expertName} didn&apos;t confirm your session within 5 minutes, so the
        request has been cancelled. You won&apos;t be charged. Please book a
        new expert — someone else may be available right away.
      </p>

      <button
        type="button"
        onClick={onCancelAndBook}
        disabled={cancelling}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-60"
      >
        {cancelling ? (
          <Icons.spinner className="h-4 w-4 animate-spin" />
        ) : (
          <Icons.search className="h-4 w-4" />
        )}
        Book a new expert
      </button>
      <button
        type="button"
        onClick={onBookings}
        className="text-sm font-bold text-muted-foreground transition-colors hover:text-accent"
      >
        View my bookings
      </button>
    </div>
  );
}

export default function ConsultWaiting() {
  const { consultationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Expert identity rides in from the booking form (state); on a direct
  // refresh we fall back to the consultation record once it loads.
  const [consultation, setConsultation] = useState(null);
  const expertName =
    location.state?.expertName || consultation?.expert?.fullName || "your expert";
  const expertAvatar = location.state?.expertAvatar || consultation?.expert?.avatar?.url;

  const [status, setStatus] = useState("PENDING");
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const settledRef = useRef(false);

  const goBookings = useCallback(() => {
    navigate("/bookings", { replace: true });
  }, [navigate]);

  // Source of truth: the consultation record. The WS event triggers a
  // refetch — the socket is a signal, the API is the truth.
  const refresh = useCallback(async () => {
    if (!consultationId || settledRef.current) return;
    try {
      const consultation = await getConsultation(consultationId);
      const next = consultation?.status || "PENDING";
      setConsultation(consultation);
      settledRef.current = next !== "PENDING";
      setStatus(next);
    } catch {
      /* transient — the poll will try again */
    }
  }, [consultationId]);

  // Polling fallback (also the initial load).
  useEffect(() => {
    refresh();
    if (!consultationId) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh, consultationId]);

  // Live updates over the WebSocket.
  useConsultationEvents(consultationId, () => refresh());

  /**
   * Server-clock-driven timers. The backend issues `confirmDeadline`
   * (booking creation time + 5 min) and auto-cancels at that moment in its
   * own sweep — navigating away, closing the tab, or losing the socket
   * never moves it. This page just mirrors the deadline for presentation:
   * the "Getting late?" nudge opens at the 2-minute mark and, at expiry,
   * the local cancel is a best-effort catch-up (the API call is idempotent
   * and the sweep is the authority).
   *
   * sessionStorage keeps the deadline so the countdown survives page
   * navigation within this browser (e.g. waiting → bookings → waiting).
   */
  const deadlineKey = `lbz_confirm_deadline_${consultationId}`;
  const deadline = useMemo(() => {
    const fromPayload = consultation?.confirmDeadline
      ? new Date(consultation.confirmDeadline).getTime()
      : null;
    if (fromPayload) return fromPayload;
    try {
      const stored = Number(sessionStorage.getItem(deadlineKey));
      if (stored) return stored;
    } catch {
      /* storage unavailable — fall back to a fresh window */
    }
    return null;
  }, [consultation?.confirmDeadline, deadlineKey]);

  // Persist the computed deadline so back-and-forth navigation keeps the
  // original countdown instead of restarting it.
  useEffect(() => {
    if (deadline) return;
    const fromPayload = consultation?.confirmDeadline
      ? new Date(consultation.confirmDeadline).getTime()
      : Date.now() + FALLBACK_DEADLINE_MS;
    try {
      sessionStorage.setItem(deadlineKey, String(fromPayload));
    } catch {
      /* storage unavailable — timers just restart on reload */
    }
  }, [deadline, consultation?.confirmDeadline, deadlineKey]);

  const msLeft = deadline ? deadline - Date.now() : MAX_WAIT_MS;

  // 2-minute-mark nudge.
  useEffect(() => {
    if (!deadline || settledRef.current) return undefined;
    const nudgeAt = deadline - (MAX_WAIT_MS - NUDGE_MS);
    const wait = Math.max(0, nudgeAt - Date.now());
    const timer = setTimeout(() => setNudgeOpen(true), wait);
    return () => clearTimeout(timer);
  }, [deadline]);

  // At the deadline: best-effort local cancel (the backend sweep is the
  // authority; this covers a sweep latency gap so the user never waits).
  useEffect(() => {
    if (!deadline || settledRef.current) return undefined;
    const wait = Math.max(0, deadline - Date.now());
    const timer = setTimeout(async () => {
      if (settledRef.current) return;
      settledRef.current = true;
      setExpired(true);
      setNudgeOpen(false);
      try {
        await cancel(consultationId, "Expert did not confirm the session");
      } catch {
        /* already cancelled server-side */
      }
    }, wait);
    return () => clearTimeout(timer);
  }, [deadline, consultationId]);

  useEffect(() => {
    if (status === "CANCELLED" || status === "EXPIRED") {
      settledRef.current = true;
      setExpired(true);
      setNudgeOpen(false);
    }
  }, [status]);

  const confirmed = status === "CONFIRMED";
  const cancelled = expired || status === "CANCELLED" || status === "EXPIRED";

  /**
   * "Book a new expert" — always cancel the pending request first so
   * nothing is left dangling, then open the search. Cancelling an already
   * cancelled/expired request is a no-op server-side; errors don't block
   * the navigation.
   */
  const handleCancelAndBookNew = useCallback(async () => {
    setCancelling(true);
    try {
      if (!settledRef.current) {
        settledRef.current = true;
        await cancel(consultationId, "User booked a different expert");
      }
    } catch {
      /* nothing left to cancel — continue to search either way */
    } finally {
      setCancelling(false);
      navigate("/consult/book", { replace: true });
    }
  }, [consultationId, navigate]);

  const handlePay = async () => {
    if (!consultationId || paying) return;
    setPaying(true);
    try {
      await openPayment("consultation", consultationId);
      goBookings();
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message ||
          err.message ||
          "Could not open payment. Please try again.",
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 font-sans text-foreground selection:bg-accent/20 md:py-16">
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 text-center">
        <button
          type="button"
          onClick={goBookings}
          className="self-start inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-accent"
        >
          <Icons.arrowLeft className="h-4 w-4" />
          My Bookings
        </button>

        {cancelled ? (
          <ExpiredScreen
            expertName={expertName}
            onCancelAndBook={handleCancelAndBookNew}
            onBookings={goBookings}
            cancelling={cancelling}
          />
        ) : (
          <>
            <AvatarWithRings
              avatarUrl={expertAvatar}
              name={expertName}
              confirmed={confirmed}
            />

            {confirmed ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-4 py-1.5 text-xs font-extrabold text-success">
                  <Icons.checkCircle className="h-4 w-4" />
                  Session confirmed
                </span>

                <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
                  You&rsquo;re almost there
                </h1>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground md:text-base">
                  {expertName} has confirmed your session. Complete the
                  payment to secure your slot — your session room opens as
                  soon as the payment goes through.
                </p>

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-extrabold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
                >
                  {paying ? (
                    <Icons.spinner className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.money className="h-4 w-4" />
                  )}
                  Pay now
                </button>
              </>
            ) : (
              <>
                <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
                  Confirming your session
                </h1>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground md:text-base">
                  Your request has been sent to{" "}
                  <span className="font-bold text-foreground">{expertName}</span>
                  . We&apos;ll confirm the moment the expert responds — you can
                  keep this page open, or check back anytime under My
                  Bookings.
                </p>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Icons.spinner className="h-3.5 w-3.5 animate-spin text-primary" />
                  Awaiting confirmation…
                </span>
              </>
            )}
          </>
        )}
      </div>

      {nudgeOpen && !confirmed && !cancelled && (
        <GettingLateModal
          expertName={expertName}
          onDismiss={() => setNudgeOpen(false)}
          onBookOther={handleCancelAndBookNew}
        />
      )}
    </div>
  );
}
