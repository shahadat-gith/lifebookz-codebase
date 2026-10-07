import api from '../config/api';

/**
 * Consultation API for the expert portal — simplified lifecycle:
 * request → confirm → user pays at the room door → session → completed → rating.
 */

// ---------------------------------------------------------------------------
// Consultations
// ---------------------------------------------------------------------------

export async function listMine() {
  const res = await api.get('/consultations/expert');
  return res.data.data;
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

