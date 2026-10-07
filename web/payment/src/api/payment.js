import api from '../config/api';

/**
 * Payment API — resource-generic, mirroring the backend
 * (`/payments/order/:resource/:resourceId`). Today the only resource is
 * "consultation"; new payable resources use the same URLs.
 *
 * The amount and paid state ALWAYS come from the backend — nothing in the
 * URL is trusted.
 */

/** What the checkout page renders: paid? payable? how much? */
export async function paymentState(resource, resourceId) {
  const res = await api.get(`/payments/${resource}/${resourceId}/state`);
  return res.data.data;
}

/** Creates (or re-opens) the Razorpay order for the resource. */
export async function createOrder(resource, resourceId) {
  const res = await api.post(`/payments/order/${resource}/${resourceId}`);
  return res.data.data; // { keyId, orderId, amount, currency }
}

/**
 * Verifies the checkout handshake server-side and returns
 * `{ resourceId, redirectUrl }` — the intended destination after payment.
 */
export async function verifyPayment(resource, { resourceId, ...handshake }) {
  const res = await api.post(`/payments/verify/${resource}`, {
    resourceId,
    ...handshake,
  });
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Cross-subdomain session handoff (same mechanism the consultations portal
// uses — one-time ticket in, regular JWT out; one credential system).
// ---------------------------------------------------------------------------

/**
 * Mint a fresh one-time ticket — used on the success screen so the next
 * portal (the session room) opens already signed-in as this user.
 */
export async function mintHandoffTicket() {
  const res = await api.post('/consultations/handoff');
  return res.data.data.code;
}

/** Swap the one-time handoff ticket for this portal's own JWT. */
export async function exchangeHandoffTicket(code) {
  const res = await api.post('/consultations/handoff/exchange', { code });
  return res.data.data; // { token, role }
}

/** Who am I? Uses the same backend endpoints the portals use. */
export async function fetchAccount(role) {
  const res = await api.get(role === 'expert' ? '/experts/me' : '/users/me');
  return res.data.data;
}
