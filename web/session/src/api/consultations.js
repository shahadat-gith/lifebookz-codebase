import api from '../config/api';

/**
 * Session-room API — only what a live meeting and its rating need. The
 * business workflow (booking, accepting, cancelling, payments) stays in the
 * client and expert portals; this portal is the room itself.
 *
 * Identity is resolved entirely server-side: `/join` returns the caller's
 * role from the authenticated token, never from the URL.
 */

// ---------------------------------------------------------------------------
// Live session
// ---------------------------------------------------------------------------

/**
 * The one entry point: authorize the caller, resolve their role, and hand
 * back the Chime meeting/attendee pair. Unpaid clients get
 * `paymentRequired: true` — no room keys until the payment portal has done
 * its job.
 */
export async function joinConsultation(id) {
  const res = await api.get(`/consultations/${id}/join`);
  return res.data.data;
}

export async function joinSession(id) {
  const res = await api.post(`/consultations/${id}/session/join`);
  return res.data.data;
}

export async function heartbeat(id) {
  const res = await api.post(`/consultations/${id}/session/heartbeat`);
  return res.data.data;
}

export async function endSession(id, reason) {
  const res = await api.post(`/consultations/${id}/session/end`, reason ? { reason } : {});
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Rating (client side, after the meeting)
// ---------------------------------------------------------------------------

export async function rateConsultation(id, score, review) {
  const res = await api.post(`/consultations/${id}/rating`, { score, review });
  return res.data.data;
}

/** Participant-only read — powers the rating page's context. */
export async function getConsultation(id) {
  const res = await api.get(`/consultations/${id}`);
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Cross-subdomain session handoff
// ---------------------------------------------------------------------------

/**
 * Mint a fresh one-time ticket — used to bounce an unpaid client over to
 * the payment portal with their session intact.
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

// Media runs on the Amazon Chime SDK — no signaling API needed.
