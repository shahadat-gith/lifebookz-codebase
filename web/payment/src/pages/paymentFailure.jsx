import { useLocation, useNavigate, useParams } from "react-router-dom";

import { CheckoutShell } from "../components/Logo";
import { Icon, Paths } from "../components/Icons";

/**
 * Payment failure — `/pay/consultation/<id>/failure`.
 *
 * A clear message and one obvious way forward. Failed attempts are retried
 * in place; the money is only ever taken after a verified server-side
 * handshake.
 */
export default function PaymentFailurePage() {
  const { "for": resource, id: resourceId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const message = state?.message || "Payment could not be completed. Please try again.";
  const retriable = state?.retriable !== false;

  return (
    <CheckoutShell>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Icon path={Paths.infoCircle} className="h-8 w-8" />
        </div>

        <h1 className="mt-5 font-display text-2xl font-bold text-foreground">
          Payment unsuccessful
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>

        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          No amount was captured. Your card may show a temporary hold that
          clears on its own.
        </p>

        {retriable ? (
          <button
            type="button"
            onClick={() => navigate(`/pay/${resource}/${resourceId}`, { replace: true })}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:brightness-110"
          >
            <Icon path={Paths.refresh} className="h-4 w-4" />
            Try again
          </button>
        ) : (
          <a
            href={`${(import.meta.env.VITE_CLIENT_URL || "").replace(/\/$/, "")}/bookings`}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Back to My Bookings
          </a>
        )}
      </div>
    </CheckoutShell>
  );
}
