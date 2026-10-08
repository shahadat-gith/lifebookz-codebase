import api from "../config/api";
import type { Consultation, Expert } from "../types";

/**
 * Consultation API — same simplified lifecycle as the web client.
 *
 * Request → expert confirms → room link emailed → user pays at the room
 * door → one-to-one video session → completed → rating.
 */

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export async function matchExperts({
  problem,
  category,
  limit,
}: {
  problem: string;
  category?: string;
  limit?: number;
}): Promise<{ experts: Expert[] }> {
  const res = await api.post("/consultations/match", { problem, category, limit });
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function createRequest({
  expertId,
  problem,
  category,
  notes,
}: {
  expertId: string;
  problem: string;
  category?: string;
  notes?: string;
}): Promise<Consultation> {
  const res = await api.post("/consultations/requests", {
    expertId,
    problem,
    category,
    notes,
  });
  return res.data.data;
}

export async function listMine({ limit, page }: { limit?: number; page?: number } = {}): Promise<Consultation[]> {
  const res = await api.get("/consultations/mine", {
    params: {
      ...(limit ? { limit } : {}),
      ...(page ? { page } : {}),
    },
  });
  const data = res.data.data;
  return Array.isArray(data) ? data : data?.consultations || data?.items || [];
}

export async function getConsultation(id: string): Promise<Consultation> {
  const res = await api.get(`/consultations/${id}`);
  return res.data.data;
}

export async function cancel(id: string, reason?: string) {
  const res = await api.post(`/consultations/${id}/cancel`, reason ? { reason } : {});
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Video session
// ---------------------------------------------------------------------------

export interface SessionInfo {
  paymentRequired?: boolean;
  sessionUrl?: string;
  [key: string]: unknown;
}

export async function getSession(id: string): Promise<SessionInfo> {
  const res = await api.get(`/consultations/${id}/session`);
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

export async function rate(id: string, score: number, review?: string) {
  const res = await api.post(`/consultations/${id}/rating`, { score, review });
  return res.data.data;
}
