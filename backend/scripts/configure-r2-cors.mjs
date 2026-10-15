/**
 * One-off configuration script: set the CORS policy on the Lifebookz R2
 * bucket so the browser can upload DIRECTLY to R2 (the presigned-PUT flow
 * used by every portal — avatars, covers, story media).
 *
 * Why: uploads never work from any portal when the bucket answers OPTIONS
 * preflights with 403/no headers. The rule set below is deliberately
 * conservative — writes (PUT/DELETE) only from the portals, reads
 * (GET/HEAD) publicly (the objects are served as public URLs anyway).
 *
 * Existing rules are preserved and merged; nothing else on the bucket is
 * touched. Idempotent — running it twice converges on the same policy.
 *
 * Usage: node scripts/configure-r2-cors.mjs
 */
import dotenv from "dotenv";
dotenv.config();

import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";

const DEV_ORIGINS = [
  "http://localhost:5173", // client portal
  "http://localhost:5174", // author portal
  "http://localhost:5175", // expert portal
  "http://localhost:5176", // admin portal
  "http://localhost:5177", // developer / session / payment portals
];

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

async function main() {
  const { config } = await import("../src/config/index.js");
  const { s3, BUCKET } = await import("../src/config/r2.js");

  if (!BUCKET) {
    console.error("R2 bucket is not configured.");
    process.exit(1);
  }

  // Production portal origins from the backend env, pathless.
  const prodOrigins = Object.values(config.frontend)
    .filter(Boolean)
    .map(originOf)
    .filter(Boolean);

  const existing = await s3
    .send(new GetBucketCorsCommand({ Bucket: BUCKET }))
    .then((res) => res.CORSRules || [])
    .catch(() => []);
  console.log(
    "Existing CORS rules:",
    existing.length ? JSON.stringify(existing) : "(none)",
  );

  // Merge with any pre-existing rule origins (nothing is clobbered).
  const knownWriteOrigins = [
    ...DEV_ORIGINS,
    ...prodOrigins,
    ...existing.flatMap((r) => r.AllowedOrigins || []),
  ];
  const writeOrigins = [...new Set(knownWriteOrigins)].filter(Boolean);
  console.log("Write origins:", writeOrigins.join(", "));

  const hasPublicRead = existing.some((r) =>
    (r.AllowedOrigins || []).includes("*"),
  );

  const corsRules = [
    ...(hasPublicRead
      ? []
      : [
          {
            // Public reads — <img>/fetch of the stored public URLs.
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "HEAD"],
            AllowedHeaders: ["*"],
            MaxAgeSeconds: 3000,
          },
        ]),
    {
      // Direct uploads from the portals (avatars, covers, story media).
      AllowedOrigins: writeOrigins,
      AllowedMethods: ["PUT", "DELETE"],
      AllowedHeaders: ["content-type", "content-length"],
      ExposeHeaders: ["etag"],
      MaxAgeSeconds: 3000,
    },
  ];

  await s3.send(new PutBucketCorsCommand({ Bucket: BUCKET, CORSConfiguration: { CORSRules: corsRules } }));
  console.log("CORS policy applied.");

  const after = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
  console.log("Stored CORS rules:", JSON.stringify(after.CORSRules, null, 1));

  await (await import("../src/config/database.js")).connectDatabase().catch(() => {});
  await (await import("mongoose")).disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
