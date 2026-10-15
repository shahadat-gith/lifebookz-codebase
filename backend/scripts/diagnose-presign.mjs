/**
 * One-off diagnostic: checks the avatar-upload chain end to end WITHOUT
 * modifying anything —
 *   1. can the backend mint a presigned PUT URL (R2 credentials valid)?
 *   2. does the R2 bucket answer browser CORS preflights (OPTIONS) with
 *      Access-Control-Allow-Origin for the portal dev origins?
 *
 * If step 2 fails with no CORS headers, browser uploads fail in EVERY
 * portal exactly like "did not work" reports — the bucket needs a CORS
 * policy allowing PUT/GET/HEAD.
 *
 * Usage: node scripts/diagnose-presign.mjs
 */
import dotenv from "dotenv";
dotenv.config();

const ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

async function main() {
  const { createPresignedUpload, s3, BUCKET } = await import("../src/config/r2.js");

  console.log("bucket configured:", Boolean(BUCKET));

  // 1. Presign (SigV4 is computed locally — no network needed, but bad
  //    credentials surface here too at signing time).
  let uploadUrl;
  let key;
  try {
    const upload = await createPresignedUpload({
      kind: "avatar",
      contentType: "image/png",
      ext: "png",
    });
    uploadUrl = upload.uploadUrl;
    key = upload.key;
    console.log("presign: OK  key =", key);
  } catch (error) {
    console.log("presign: FAILED —", error.message);
    process.exit(1);
  }

  // 2. CORS preflight probe, one per portal origin.
  for (const origin of ORIGINS) {
    try {
      const res = await fetch(uploadUrl, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "content-type",
        },
      });
      const acao = res.headers.get("access-control-allow-origin");
      const acam = res.headers.get("access-control-allow-methods");
      console.log(
        `CORS ${origin} → status ${res.status} allow-origin=${acao || "(none)"} allow-methods=${acam || "(none)"}`,
      );
    } catch (error) {
      console.log(`CORS ${origin} → request failed: ${error.message}`);
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
