/**
 * One-off maintenance script: drop the stale, impossible `users` index that
 * an earlier schema version auto-created:
 *
 *   { roles: 1, "expert.categories": 1, "expert.rating": -1 }
 *
 * MongoDB rejects documents where ONE index covers TWO array paths
 * ("cannot index parallel arrays [categories] [roles]") — every expert
 * upgrade write fails while this index exists. The schema now declares
 * { "expert.categories": 1, "expert.rating": -1 } (roles is NOT an index
 * key beside it), but a schema change alone never drops an index MongoDB
 * already built — this script does.
 *
 * Usage: node scripts/drop-stale-roles-index.mjs
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "node:dns";

dotenv.config();
dns.setServers(["8.8.8.8"]);

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

  const discoverUri = `mongodb://${creds}@${hosts[0]}/admin?${new URLSearchParams(
    { ssl: "true", authSource: "admin", directConnection: "true" },
  ).toString()}`;
  await mongoose.connect(discoverUri);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  await mongoose.disconnect();

  const setName = hello.setName;
  const primary = (hello.primary || "").split("/")[0] || hosts[0];

  return setName
    ? `mongodb://${creds}@${hosts.join(",")}${dbPath || "/primary"}?${new URLSearchParams(
        { ssl: "true", authSource: "admin", replicaSet: setName },
      ).toString()}`
    : `mongodb://${creds}@${primary}${dbPath || "/primary"}?${new URLSearchParams(
        { ssl: "true", authSource: "admin", directConnection: "true" },
      ).toString()}`;
}

async function main() {
  const raw = process.env.MONGODB_URI;
  if (!raw) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }

  const uri = await directUri(raw.trim().replace(/^["']|["']$/g, ""));
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection("users");

  // The harmful shape: any index whose key contains BOTH the `roles` array
  // and the `expert.categories` array (or any second array field).
  const isStale = (key) => "roles" in key && "expert.categories" in key;

  const indexes = await collection.indexes();
  const stale = indexes.filter((idx) => isStale(idx.key));

  if (stale.length === 0) {
    console.log("No stale parallel-arrays index on users — nothing to drop.");
  } else {
    for (const idx of stale) {
      await collection.dropIndex(idx.name);
      console.log(`Dropped stale index "${idx.name}" from users.`);
    }
  }

  console.log(
    "Remaining users indexes:",
    (await collection.indexes()).map((idx) => idx.name).join(", "),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
