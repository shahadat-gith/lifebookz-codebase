/**
 * One-off maintenance script: drop the harmful `uniq_rating_when_rated`
 * unique index from the consultations collection.
 *
 * The index was `unique` on `rating.score` across the whole collection, so
 * only the FIRST rated consultation ever could succeed — every later rating
 * (any session, any user) failed with E11000 duplicate key. One-rating-per-
 * consultation is enforced by the guarded findOneAndUpdate in
 * rateConsultation instead; the index must go.
 *
 * Works on networks where SRV DNS lookups (mongodb+srv://) are blocked:
 * resolves the shard hosts through DNS-over-HTTPS (dns.google) and builds a
 * direct mongodb:// connection string instead.
 *
 * Usage: node scripts/drop-rating-unique-index.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const INDEX_NAME = "uniq_rating_when_rated";

/** Resolve a record via DNS-over-HTTPS (no raw-UDP DNS needed). */
async function doh(name, type) {
  const res = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
  );
  const json = await res.json();
  return json.Answer || [];
}

/** Build a direct (non-SRV) mongodb:// URI for an Atlas cluster. */
async function directUri(srvUri) {
  const match = srvUri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)(\/?[^?]*)?(\?.*)?$/);
  if (!match) return srvUri; // already direct — use as-is

  const [, creds, clusterHost, dbPath = "", query = ""] = match;

  const answers = await doh(`_mongodb._tcp.${clusterHost}`, "SRV");
  const hosts = answers
    .map((a) => a.data.split(" ")[3].replace(/\.$/, ""))
    .filter(Boolean);
  if (!hosts.length) throw new Error(`SRV resolution failed for ${clusterHost}`);

  // Discover the real replica set name + primary by dialing one shard host
  // directly (Atlas hides the setName from the SRV seed).
  const discoverUri = `mongodb://${creds}@${hosts[0]}/admin?${new URLSearchParams(
    { ssl: "true", authSource: "admin", directConnection: "true" },
  ).toString()}`;
  await mongoose.connect(discoverUri);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  await mongoose.disconnect();

  const setName = hello.setName;
  const primary = (hello.primary || "").split("/")[0] || hosts[0];
  console.log(`Replica set: ${setName || "(none)"}, primary: ${primary}`);

  return setName
    ? `mongodb://${creds}@${hosts.join(",")}${dbPath || "/primary"}?${new URLSearchParams(
        { ssl: "true", authSource: "admin", replicaSet: setName },
      ).toString()}`
    : `mongodb://${creds}@${primary}${dbPath || "/primary"}?${new URLSearchParams(
        { ssl: "true", authSource: "admin", directConnection: "true" },
      ).toString()}`;
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const uri = await directUri(raw.trim().replace(/^["']|["']$/g, ""));
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection("consultations");

  const indexes = await collection.indexes();
  const stale = indexes.find((idx) => idx.name === INDEX_NAME);

  if (!stale) {
    console.log(`Index "${INDEX_NAME}" not found — nothing to drop.`);
  } else {
    await collection.dropIndex(INDEX_NAME);
    console.log(`Dropped index "${INDEX_NAME}" from consultations.`);
  }

  const remaining = (await collection.indexes()).map((idx) => idx.name);
  console.log("Remaining indexes:", remaining.join(", "));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
