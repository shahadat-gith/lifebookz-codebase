/**
 * Cross-subdomain redirects.
 *
 * Live sessions and checkout live on their own portals now
 * (consult.lifebookz.com / payment.lifebookz.com). This browser's JWT is
 * origin-scoped, so the portals can't just share it — instead the target
 * portal is opened with a one-time ticket in the URL *hash* (hashes never
 * reach a server, history, or logs):
 *
 *   1. this portal trades its own still-valid token for a one-time ticket
 *      (POST /consultations/handoff — same backend, same JWT secret)
 *   2. redirect to <portal>/handoff/...#tk=<ticket>
 *   3. that portal exchanges the ticket for its own JWT and proceeds
 *
 * Same credential system end-to-end; nothing new is trusted.
 */
import api from "../config/api";

/** Backend base URL of a portal from env, minus trailing slash. */
function portalBase(envValue) {
  return (envValue || "").replace(/\/$/, "");
}

async function mintTicket() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No active session to hand off.");

  const res = await api.post("/consultations/handoff");
  return res.data.data.code;
}

/**
 * Open the payment portal for a resource (e.g. "consultation") in a new
 * tab: /pay/<resource>/<id>. The one-time ticket rides in the URL
 * hash so the checkout opens already signed-in. Throws (so callers can
 * show a toast) when the portal isn't configured or the ticket can't be
 * minted — never silently.
 */
export async function openPayment(resource, resourceId) {
  const paymentBase = portalBase(import.meta.env.VITE_PAYMENT_URL);
  if (!paymentBase) {
    throw new Error(
      "The payment portal isn't configured (VITE_PAYMENT_URL missing).",
    );
  }

  const code = await mintTicket();
  window.open(
    `${paymentBase}/pay/${encodeURIComponent(resource)}/${encodeURIComponent(resourceId)}#tk=${code}`,
    "_blank",
    "noopener",
  );
}

/**
 * Open the live session room in a new tab:
 * /session/<id>. The one-time ticket rides in the URL hash so the room
 * opens already signed-in. Throws when unconfigured.
 */
export async function openConsultation(consultationId) {
  const sessionBase = portalBase(import.meta.env.VITE_SESSION_URL);
  if (!sessionBase) {
    throw new Error(
      "The session portal isn't configured (VITE_SESSION_URL missing).",
    );
  }

  const code = await mintTicket();
  window.open(
    `${sessionBase}/session/${consultationId}#tk=${code}`,
    "_blank",
    "noopener",
  );
}
