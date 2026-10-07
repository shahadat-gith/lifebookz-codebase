import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { openConsultation, openPayment } from "../utils/handoff";

/**
 * Trampoline routes — kept for old links (e.g. the emails sent before this
 * refactor). They run the same handoff as the Join buttons and land the user
 * on the right portal.
 *
 *   /consult/:id/session → the live consultation room
 *   /consult/:id/pay     → the payment portal (pay at the door)
 */
function usePortalRedirect(run) {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await run();
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.error?.message ||
              err?.message ||
              "Could not open that portal.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [run]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center font-sans text-foreground">
        <h1 className="font-display text-2xl font-bold">Redirect failed</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
        <a
          href="/bookings"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          Back to My Bookings
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background font-sans text-foreground">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
      <p className="text-sm text-muted-foreground">Taking you there…</p>
    </div>
  );
}

export function ConsultationRedirect() {
  const { consultationId } = useParams();
  return usePortalRedirect(() => openConsultation(consultationId));
}

export function PaymentRedirect() {
  const { consultationId } = useParams();
  return usePortalRedirect(() => openPayment("consultation", consultationId));
}
