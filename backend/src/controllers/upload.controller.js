import {
  createPresignedUpload,
  deleteObject,
  objectKeyFromUrl,
} from "../config/r2.js";
import { validationError } from "../utils/errors.js";

// One controller backs EVERY upload in the platform — story media on the
// author side, avatars and covers on every dashboard — always through the
// same presigned PUT URL: the browser uploads straight to R2 and only the
// resulting { url, key } pair reaches this server.

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
  "video/mpeg",
];

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

/** Uploadable kinds — folder layout lives in config/r2.js. */
const KINDS = {
  image: { folder: "stories/media/images", types: IMAGE_TYPES, limit: MAX_IMAGE_BYTES, label: "Photos must be 15 MB or smaller." },
  video: { folder: "stories/media/videos", types: VIDEO_TYPES, limit: MAX_VIDEO_BYTES, label: "Videos must be 500 MB or smaller." },
  avatar: { folder: "avatars", types: IMAGE_TYPES, limit: MAX_IMAGE_BYTES, label: "Profile photos must be 15 MB or smaller." },
  cover: { folder: "covers", types: IMAGE_TYPES, limit: MAX_IMAGE_BYTES, label: "Cover images must be 15 MB or smaller." },
};

function extFromName(filename = "") {
  const match = filename.match(/\.([a-zA-Z0-9]{1,8})$/);
  return match ? match[1].toLowerCase() : "";
}

/**
 * POST /uploads/presign
 * { kind: "image"|"video"|"avatar"|"cover", contentType, filename, size }
 * → { uploadUrl, key, url, expiresIn }
 *
 * The stored URL is returned immediately — the file never passes through
 * this server, and the PUT lands before clients save the reference.
 */
export async function presignUpload(req, res, next) {
  try {
    const { kind, contentType, filename, size } = req.body || {};

    const spec = KINDS[kind];

    if (!spec) {
      throw validationError(
        `Unknown upload kind "${kind}". Allowed: ${Object.keys(KINDS).join(", ")}.`,
      );
    }

    if (!spec.types.includes(contentType)) {
      throw validationError(
        kind === "video"
          ? "Unsupported video type."
          : "Unsupported image type. Only photos are allowed.",
      );
    }

    const bytes = Number(size) || 0;
    if (bytes > spec.limit) {
      throw validationError(spec.label);
    }

    const upload = await createPresignedUpload({
      kind,
      contentType,
      ext: extFromName(filename),
    });

    res.status(201).json({
      success: true,
      data: {
        uploadUrl: upload.uploadUrl,
        key: upload.key,
        url: upload.url,
        expiresIn: upload.expiresIn,
        kind,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /uploads — remove an uploaded object from R2 by key or url.
 * Only objects this platform actually created (its folders) may go.
 */
export async function deleteUpload(req, res, next) {
  try {
    const { key, url } = req.body || {};
    const objectKey = key || objectKeyFromUrl(url);

    if (!objectKey) {
      throw validationError("Provide the upload key or url to delete.");
    }

    if (!Object.values(KINDS).some((spec) => objectKey.startsWith(spec.folder))) {
      throw validationError("This upload cannot be deleted from here.");
    }

    await deleteObject({ key: objectKey });

    res.json({ success: true, message: "Upload deleted." });
  } catch (error) {
    next(error);
  }
}
