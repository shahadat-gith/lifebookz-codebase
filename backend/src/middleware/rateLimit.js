import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import config from "../config/index.js";
import { logger } from "../services/logger.service.js";

/**
 * Real client IP behind the deployment chain (Cloudflare → API Gateway →
 * Lambda): Cloudflare sets CF-Connecting-IP, API Gateway appends to
 * X-Forwarded-For. `req.ip` alone can't be trusted through serverless-http.
 */
export function clientIp(req) {
  const cf = req.get?.("cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = req.get?.("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  return req.ip || "unknown";
}

/**
 * Rate-limit bucket key: the client IP, with IPv6 addresses collapsed to
 * their /64 subnet (the library's own helper) so one device can't mint
 * unlimited buckets by rotating addresses.
 */
function bucketKey(req) {
  return ipKeyGenerator(clientIp(req));
}

/**
 * Background bot probes for exposed Gradio/Streamlit/MCP/Spring admin
 * endpoints (see the constant 404 stream in the logs). Rate limiting them
 * is pointless — answer instantly and don't burn limiter buckets.
 */
const PROBE_PATH_RE =
  /^\/(gradio_api|_stcore|actuator|v1\/mcp|sse|messages|\.env|wp-admin|wp-login|phpmyadmin|admin\.php|config\.php)(\/|$)/i;

export function isProbeRequest(req) {
  return PROBE_PATH_RE.test(req.originalUrl || req.url || "");
}

const jsonHandler = (message) => (_req, res) => {
  res.status(429).json({
    success: false,
    error: {
      code: "RATE_LIMITED",
      message,
    },
  });
};

/** Standard store/logging options shared by every limiter. */
const base = {
  // The IP comes from the custom keyGenerator, not req.ip, so the library's
  // trust-proxy validation is intentionally disabled.
  validate: { trustProxy: false, xForwardedForHeader: false },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      method: req.method,
      path: req.originalUrl || req.url,
      ip: bucketKey(req),
      role: req.role || "anonymous",
      code: "RATE_LIMITED",
    });
    return jsonHandler("Too many requests — please slow down and try again shortly.")(req, res);
  },
  keyGenerator: bucketKey,
};

/**
 * Global API limiter — a generous ceiling that only trips on abuse and
 * runaway loops, never on real usage (every limiter counts per client IP).
 * Probe requests pass through untouched.
 */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 300,
  skip: (req) => isProbeRequest(req) || webhookSkip(req),
});

/**
 * Auth limiter — mounted on every credential route (login / register /
 * forgot / reset) across user, expert, author, admin and developer portals.
 * Strict enough to make password brute-force useless, loose enough that a
 * family behind one office NAT can still sign in.
 */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  skipSuccessfulRequests: true, // only failed attempts count
  skip: (req) => isProbeRequest(req),
});

/**
 * The Razorpay webhook is server-to-server (Razorpay's IPs, not users') —
 * never rate limit it, a dropped webhook means a lost payment record.
 */
export const webhookSkip = (req) =>
  (req.originalUrl || req.url || "").startsWith("/api/v1/payments/webhook");
