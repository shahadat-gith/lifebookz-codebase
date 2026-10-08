import api from "../config/api";

/**
 * Consultation API — simplified lifecycle.
 *
 * Request → expert confirms → room link emailed → user pays at the room
 * door → one-to-one video session → completed → rating.
 */

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export async function matchExperts({ problem, category, limit }) {
  const res = await api.post("/consultations/match", { problem, category, limit });
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function createRequest({ expertId, problem, category, notes }) {
  const res = await api.post("/consultations/requests", {
    expertId,
    problem,
    category,
    notes,
  });
  return res.data.data;
}

export async function listMine({ limit, page } = {}) {
  const res = await api.get("/consultations/mine", {
    params: { ...(limit ? { limit } : {}), ...(page ? { page } : {}) },
  });
  const data = res.data.data;
  return Array.isArray(data) ? data : data?.consultations || data?.items || [];
}

export async function getConsultation(id) {
  const res = await api.get(`/consultations/${id}`);
  return res.data.data;
}

export async function cancel(id, reason) {
  const res = await api.post(`/consultations/${id}/cancel`, reason ? { reason } : {});
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Video session
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

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

export async function rate(id, score, review) {
  const res = await api.post(`/consultations/${id}/rating`, { score, review });
  return res.data.data;
}
