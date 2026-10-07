import axios from "axios";

/** The message the API sent back for a failed request, or a fallback. */
export function apiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as any)?.error?.message || fallback
    );
  }
  return fallback;
}

/**
 * The API's message plus the per-field errors it attached
 * (`{ password: "Incorrect password." }`), so forms can mark inputs.
 */
export function apiError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): { message: string; fields: Record<string, string> } {
  const payload = axios.isAxiosError(error)
    ? (error.response?.data as any)?.error
    : undefined;
  return {
    message: payload?.message || fallback,
    fields: payload?.fields || {},
  };
}

export function stripHtml(html?: string): string {
  return (html || "").replace(/<[^>]*>/g, "").trim();
}

export function getContentPreview(html?: string, maxLength = 120): string {
  const plain = stripHtml(html);
  if (!plain) return "";
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).replace(/\s+$/, "") + "…";
}

/** "3 d ago"-style relative time without pulling in moment. */
export function timeAgo(date?: string | number | Date): string {
  if (!date) return "";
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";

  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

export function formatDate(date?: string | number | Date): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Initials for avatar fallbacks. */
export function initials(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
