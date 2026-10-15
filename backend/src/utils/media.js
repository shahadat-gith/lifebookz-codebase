/**
 * Account images (avatar, cover) are uploaded by the client DIRECTLY to R2
 * through presigned URLs (POST /uploads/presign). The dashboard PATCHes the
 * resulting { url, key } pair to the profile endpoints — the file bytes
 * never reach this server.
 */
import { buildPublicUrl, objectKeyFromUrl } from "../config/r2.js";
import { validationError } from "./errors.js";

/**
 * Validate/normalize a presigned upload result sent from the client.
 * `undefined` means "not provided" — the caller leaves the stored image as
 * is. An object without any resolvable storage key is rejected.
 *
 * @param {unknown} value          { url, key } pair from POST /uploads/presign
 * @param {"avatar"|"coverImage"} field  field name for error messages
 * @returns {{ url: string, key: string } | undefined}
 */
export function parseImageRef(value, field) {
  if (value === undefined) return undefined;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(
      `${field} must be an upload result ({ url, key }) from POST /uploads/presign.`,
    );
  }

  if (typeof value.url !== "string" || typeof value.key !== "string") {
    throw validationError(`${field} must include both url and key.`);
  }

  const key = value.key || objectKeyFromUrl(value.url) || "";

  if (!key) {
    throw validationError(`${field} is not a valid stored image.`);
  }

  // Always store the canonical public URL for the key, never the (time
  // limited) presigned PUT url the browser posted.
  return { url: buildPublicUrl(key), key };
}
