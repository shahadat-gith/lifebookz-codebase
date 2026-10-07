import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { CheckoutShell } from "../components/Logo";
import { Icon, Paths } from "../components/Icons";
import * as paymentApi from "../api/payment";

/**
 * Payment success — `/pay/consultation/<id>/success`.
 *
 * No auto-redirect: the user decides when to continue. "Join now" opens the
 * session room; the destination (and its handoff ticket, so the room opens
 * already signed-in) comes from the backend's verify response.
 */
export default function PaymentSuccessPage() {
  const { state } = useLocation();
  const redirectUrl = state?.redirectUrl || null;
  const [joining, setJoining] = useState(false);
  const [ticketFailed, setTicketFailed] = useState(false);

  /**
   * The room lives on another subdomain, so the button first mints a
   * one-time ticket and opens the room portal with it in the URL hash —
   * the room then opens already signed-in, code stripped on arrival.
   */
  const handleJoinNow = async () => {
    if (!redirectUrl || joining) return;
    setJoining(true);
    setTicketFailed(false);

    let target = redirectUrl;
    try {
      const code = await paymentApi.mintHandoffTicket();
      target = `${redirectUrl}#tk=${code}`;
    } catch {
      setTicketFailed(true);
      setJoining(false);
      return;
    }

    window.location.href = target;
  };

  return (
    <CheckoutShell>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 text-success">
          <Icon path={Paths.checkCircle} className="h-8 w-8" />
        </div>

        <h1 className="mt-5 font-display text-2xl font-bold text-foreground">
          Payment successful
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {state?.alreadyPaid
            ? "This session was already paid — you're ready to join."
            : "You're all set — your session room is ready."}
        </p>

        {redirectUrl ? (
          <>
            <button
              type="button"
              onClick={handleJoinNow}
              disabled={joining}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:opacity-60"
            >
              {joining ? (
                <Icon path={Paths.spinner} className="h-4 w-4 animate-spin" />
              ) : (
                <Icon path={Paths.chat} className="h-4 w-4" />
              )}
              {joining ? "Opening your session…" : "Join now"}
            </button>

            {ticketFailed && (
              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Couldn't open the room directly — open your session from My
                Bookings in the LifeBookz app instead.
              </p>
            )}

            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              You can also join later from My Bookings.
            </p>
          </>
        ) : (
          <a
            href={`${(import.meta.env.VITE_CLIENT_URL || "").replace(/\/$/, "")}/bookings`}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Back to My Bookings
          </a>
        )}
      </div>
    </CheckoutShell>
  );
}
