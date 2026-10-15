import api from "../config/api";

/**
 * Upload a profile image DIRECTLY to R2:
 *  1. Ask the API for a presigned PUT URL (`kind` is "avatar" or "cover")
 *  2. PUT the file straight to storage — it never passes through the API
 *  3. Return the `{ url, key }` descriptor the profile endpoints expect
 */
export async function uploadImage(fileOrBlob, kind) {
  const contentType =
    fileOrBlob.type || (kind === "cover" ? "image/jpeg" : "image/png");

  const presignRes = await api.post("/uploads/presign", {
    contentType,
    kind,
    size: fileOrBlob.size,
    filename:
      fileOrBlob.name ||
      `${kind}.${(contentType.split("/")[1] || "jpg").split("+")[0]}`,
  });
  const { uploadUrl, url, key } = presignRes.data.data;

  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: fileOrBlob,
    headers: { "Content-Type": contentType },
  });
  if (!put.ok) {
    throw new Error("Upload failed — please try again.");
  }

  return { url, key };
}
