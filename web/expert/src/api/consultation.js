import api from '../config/api';

/**
 * Consultation API for the expert portal — simplified lifecycle:
 * request → confirm → user pays at the room door → session → completed → rating.
 */

// ---------------------------------------------------------------------------
// Consultations
// ---------------------------------------------------------------------------

/**
 * List the expert's consultations. Requests `limit`/`page` so we don't pull
 * the whole history every dashboard load; the backend may cap or ignore
 * these — the caller dedupes by id either way.
 */
export async function listMine({ limit = 10, page = 1 } = {}) {
  const res = await api.get('/consultations/expert', {
    params: { limit, page },
  });
  const data = res.data.data;
  return Array.isArray(data) ? data : data?.consultations || data?.items || [];
}

export async function getConsultation(id) {
  const res = await api.get(`/consultations/${id}`);
  return res.data.data;
}

export async function accept(id) {
  const res = await api.post(`/consultations/${id}/accept`);
  return res.data.data;
}

export async function decline(id, reason) {
  const res = await api.post(`/consultations/${id}/decline`, reason ? { reason } : {});
  return res.data.data;
}

export async function cancel(id, reason) {
  const res = await api.post(`/consultations/${id}/cancel`, reason ? { reason } : {});
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function getSession(id) {
  const res = await api.get(`/consultations/${id}/session`);
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

// Media runs on the Amazon Chime SDK — no signaling API needed.

