#!/usr/bin/env node
/**
 * Cloudflare WAF — block AI/admin scanner probe paths at the edge for the
 * lifebookz.com zone (covers api., session., payment., and every other
 * subdomain) before the requests can reach Lambda.
 *
 * Blocks (all return 403 at Cloudflare, zero backend invocations):
 *   /gradio_api/*        — Gradio AI-demo scanners
 *   /_stcore/*           — Streamlit probes
 *   /actuator*           — Spring Boot admin probes
 *   /v1/mcp, /sse, /messages — MCP-server + SSE scanners
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ZONE_ID=xxx node infra/cloudflare-waf.mjs
 *
 * The token needs Zone → "Config Rules"/WAF edit permission for the zone.
 * Idempotent: re-running updates the existing rule in place, preserving any
 * other custom rules in the zone.
 */
import process from "node:process";

const API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const RULE_DESCRIPTION = "Block AI/admin scanner probe paths";

const EXPRESSION = [
  '(starts_with(http.request.uri.path, "/gradio_api/"))',
  '(starts_with(http.request.uri.path, "/_stcore/"))',
  '(starts_with(http.request.uri.path, "/actuator"))',
  '(http.request.uri.path in {"/v1/mcp" "/sse" "/messages"})',
].join(" or ");

if (!TOKEN || !ZONE_ID) {
  console.error(
    "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID (Zone.WAF edit permission) and re-run.",
  );
  process.exit(1);
}

async function cf(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(
      `Cloudflare ${init.method || "GET"} ${path} failed: ${JSON.stringify(body.errors || body)}`,
    );
  }
  return body.result;
}

const entrypoint = await cf(
  `/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint`,
).catch((err) => {
  if (String(err).includes("404")) return null; // no custom ruleset yet
  throw err;
});

let rules;
if (!entrypoint) {
  rules = [];
} else {
  const existing = await cf(`/zones/${ZONE_ID}/rulesets/${entrypoint.id}`);
  // Keep every rule that isn't ours, refreshed to their latest version.
  rules = (existing.rules || []).filter((r) => r.description !== RULE_DESCRIPTION);
}

const scannerRule = {
  action: "block",
  expression: EXPRESSION,
  description: RULE_DESCRIPTION,
  enabled: true,
};

if (!entrypoint) {
  await cf(`/zones/${ZONE_ID}/rulesets`, {
    method: "POST",
    body: JSON.stringify({
      name: "LifeBookz custom WAF rules",
      kind: "zone",
      phase: "http_request_firewall_custom",
      rules: [scannerRule],
    }),
  });
  console.log("Created custom WAF ruleset with the scanner-block rule.");
} else {
  await cf(`/zones/${ZONE_ID}/rulesets/${entrypoint.id}`, {
    method: "PUT",
    body: JSON.stringify({ rules: [...rules, scannerRule] }),
  });
  console.log(
    `WAF rule in place (${rules.length} other custom rule(s) preserved).`,
  );
}
console.log("Expression:", EXPRESSION);
