/**
 * Cross-subdomain redirect to the live session room
 * (session.lifebookz.com).
 *
 * This browser's JWT is origin-scoped, so the room portal can't just read
 * it — instead this portal trades its still-valid token for a one-time
 * ticket (POST /consultations/handoff — same backend, same JWT secret) and
 * opens the room portal with the ticket in the URL *hash* (hashes never
 * reach a server, history, or logs). The room portal exchanges it for its
 * own JWT and proceeds. Same credential system end-to-end.
 */
import api from "../config/api";

function consultBase() {
  return (import.meta.env.VITE_SESSION_URL || "").replace(/\/$/, "");
}

/**
 * Open the live session room (/session/<id>) in a new tab. The one-time
 * ticket rides in the URL hash so the room opens already signed-in.
 * Throws (so callers can show a toast) when the session portal isn't
 * configured or the ticket can't be minted — never silently.
 */
export async function openConsultation(consultationId) {
  const base = consultBase();
  if (!base) {
    throw new Error(
      "The session portal isn't configured (VITE_SESSION_URL missing).",
    );
  }

  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Your session has expired — please sign in again.");
  }

  const res = await api.post("/consultations/handoff");
  const code = res.data.data.code;

  window.open(`${base}/session/${consultationId}#tk=${code}`, "_blank", "noopener");
}
