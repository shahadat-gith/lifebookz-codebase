# Infra — edge protection

## Cloudflare WAF: block AI/admin scanner probes

The API logs a constant stream of `404` probes for `/gradio_api/*`,
`/_stcore/*`, `/actuator`, `/v1/mcp`, `/sse`, `/messages` — bots scanning
every public domain for exposed Gradio/Streamlit/MCP/Spring admin endpoints.
LifeBookz has none of these, so the requests only cost Lambda invocations
and log noise. This rule blocks them **at Cloudflare's edge** (403, zero
backend calls) for the whole `lifebookz.com` zone.

### Run it

```bash
CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ZONE_ID=xxx node infra/cloudflare-waf.mjs
```

- Token: Cloudflare dashboard → My Profile → API Tokens → create with
  **Zone → WAF → Edit** permission for the `lifebookz.com` zone.
- Zone ID: zone overview page, right sidebar.
- Idempotent — re-running updates the rule in place and preserves every
  other custom rule in the zone.

### What it blocks (403 at the edge)

| Path | Probe target |
|------|--------------|
| `/gradio_api/*` | Gradio AI demos (Hugging Face Spaces) |
| `/_stcore/*` | Streamlit apps |
| `/actuator*` | Spring Boot admin endpoints |
| `/v1/mcp`, `/sse`, `/messages` | MCP / SSE server scanners |

### Manual alternative (dashboard)

Cloudflare → lifebookz.com → Security → WAF → Custom rules → Create rule:

- Name: `Block AI/admin scanner probe paths`
- Expression (edit mode):

```
(starts_with(http.request.uri.path, "/gradio_api/")) or (starts_with(http.request.uri.path, "/_stcore/")) or (starts_with(http.request.uri.path, "/actuator")) or (http.request.uri.path in {"/v1/mcp" "/sse" "/messages"})
```

- Action: **Block**

## Backend rate limiting (second layer, always on)

`backend/src/middleware/rateLimit.js` (wired in `app.js`):

- **Global** `/api/v1` limiter: 300 requests / 5 min / client IP.
- **Auth** limiter on every credential route (users / experts / authors /
  admin / developer): 20 *failed* attempts / 15 min / IP
  (`skipSuccessfulRequests: true`).
- Skipped: Razorpay webhook (server-to-server — a dropped webhook loses a
  payment record) and the known scanner paths (they 404 inline instantly,
  never touching a limiter bucket).
- Client IP resolves from `CF-Connecting-IP` → `X-Forwarded-For` (the
  Cloudflare → API Gateway → Lambda chain), so limits are per real client,
  not per relay.

Success responses (`2xx`) are cheap; the limiters only bite on abuse and
runaway loops.
