import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { CheckoutShell } from "../components/Logo";
import { Icon, Paths } from "../components/Icons";
import { openRazorpayCheckout } from "../utils/razorpay";
import * as paymentApi from "../api/payment";
import { useAuth } from "../context/AuthContext";

/**
 * Checkout — `/pay/consultation/<id>`.
 *
 * The amount and paid state ALWAYS come from the backend; the order is
 * created server-side and the handshake is verified server-side. Success
 * and failure live on sibling paths (`/pay/consultation/<id>/success`).
 */
export default function PaymentPage() {
  const { "for": resource, id: resourceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [phase, setPhase] = useState("loading"); // loading | ready | paying
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState("");

  // Success/failure live on sibling paths of this same checkout URL.
  const basePath = `/pay/${resource}/${resourceId}`;

  // Surface marker set by the mobile app's handoff (?platform=mobile).
  // Forwarded to the success screen so the session room it opens knows the
  // user came from the app (return-to-app rating flow).
  const rawPlatform = (searchParams.get("platform") || "").toLowerCase();
  const platform = rawPlatform === "mobile" || rawPlatform === "web" ? rawPlatform : "";

  const load = useCallback(async () => {
    if (!resource || !resourceId) {
      navigate("/pay/failure", {
        replace: true,
        state: { message: "Invalid payment link — missing resource details.", retriable: false },
      });
      return;
    }

    setPhase("loading");
    setMessage("");
    try {
      const state = await paymentApi.paymentState(resource, resourceId);

      // Already paid (or free)? Straight to the success screen, which
      // forwards to the intended destination.
      if (state.paid) {
        navigate(`${basePath}/success`, {
          replace: true,
          state: { alreadyPaid: true, redirectUrl: withPlatform(state.redirectUrl) },
        });
        return;
      }

      if (!state.payable) {
        navigate(`${basePath}/failure`, {
          replace: true,
          state: {
            message:
              "This isn't ready for payment yet. If you just booked, wait for the expert to confirm it.",
            retriable: false,
          },
        });
        return;
      }

      setOrder(state);
      setPhase("ready");
    } catch (err) {
      navigate(`${basePath}/failure`, {
        replace: true,
        state: {
          message:
            err.response?.data?.error?.message ||
            "We couldn't load this payment. Please try again.",
          retriable: true,
        },
      });
    }
  }, [resource, resourceId, basePath, navigate, platform]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Attach the platform marker (if any) to the post-payment redirect
   * target. The backend's redirectUrl points at the session room without
   * it — only callers who opened checkout with `?platform=` get it forwarded.
   */
  function withPlatform(url) {
    if (!url) return url;
    if (!platform || url.includes("platform=")) return url;
    return url.includes("?") ? `${url}&platform=${platform}` : `${url}?platform=${platform}`;
  }

  const handlePay = async () => {
    if (phase === "paying") return;
    setPhase("paying");
    setMessage("");

    try {
      const checkout = await paymentApi.createOrder(resource, resourceId);

      const handshake = await openRazorpayCheckout(checkout, {
        description: "LifeBookz payment",
        prefill: { name: user?.fullName, email: user?.email },
      });

      // Verify, with one retry — a flaky network right after a successful
      // payment must never make the user pay twice.
      let result;
      try {
        result = await paymentApi.verifyPayment(resource, { resourceId, ...handshake });
      } catch {
        result = await paymentApi.verifyPayment(resource, { resourceId, ...handshake });
      }

      navigate(`${basePath}/success`, {
        replace: true,
        state: { redirectUrl: withPlatform(result?.redirectUrl) },
      });
    } catch (err) {
      if (err?.cancelled) {
        setPhase("ready");
        setMessage("Payment cancelled — you can try again whenever you're ready.");
        return;
      }

      navigate(`${basePath}/failure`, {
        replace: true,
        state: {
          message:
            err.response?.data?.error?.message ||
            err.message ||
            "Payment could not be completed. Please try again.",
          retriable: true,
        },
      });
    }
  };

  if (phase === "loading") {
    return (
      <CheckoutShell>
        <div className="flex flex-col items-center gap-4">
          <Icon path={Paths.spinner} className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Preparing your checkout…</p>
        </div>
      </CheckoutShell>
    );
  }

  const amount = order?.amount ?? 0;
  const currency = order?.currency || "INR";

  return (
    <CheckoutShell>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-left shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Amount due
            </p>
            <p className="mt-1 font-display text-4xl font-extrabold text-foreground">
              ₹{(amount / 100).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {currency} · One-time · Includes all charges
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon path={Paths.chat} className="h-6 w-6" />
          </div>
        </div>

        <div className="my-5 border-t border-border" />

        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <Icon path={Paths.shieldCheck} className="h-4 w-4 shrink-0 text-primary" />
            Processed by Razorpay — card details never touch our servers.
          </li>
          <li className="flex items-center gap-2">
            <Icon path={Paths.checkCircle} className="h-4 w-4 shrink-0 text-primary" />
            Verified instantly — you'll continue right after payment.
          </li>
          <li className="flex items-center gap-2">
            <Icon path={Paths.lock} className="h-4 w-4 shrink-0 text-primary" />
            Already paid? You'll skip straight through — never charged twice.
          </li>
        </ul>

        {message && (
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-center text-[11px] text-muted-foreground">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={handlePay}
          disabled={phase !== "ready"}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:opacity-60"
        >
          {phase === "paying" ? (
            <>
              <Icon path={Paths.spinner} className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Icon path={Paths.lock} className="h-4 w-4" />
              Pay ₹{(amount / 100).toLocaleString("en-IN")} securely
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          By paying you agree to the session terms. Payments are handled by
          Razorpay over an encrypted connection.
        </p>
      </div>
    </CheckoutShell>
  );
}
