/**
 * All client-facing uploads — story media, avatars, covers — are uploaded
 * directly from the browser to R2 through presigned URLs
 * (see config/r2.js + controllers/upload.controller.js). This module stays
 * as the shared cleanup helper for replaced or deleted objects.
 */
import { deleteObject } from "../config/r2.js";

/** Delete a stored object by R2 key (or a full URL). Best-effort. */
export async function deleteFile(keyOrUrl) {
  if (!keyOrUrl) return;

  return deleteObject({ key: keyOrUrl, url: keyOrUrl });
}
