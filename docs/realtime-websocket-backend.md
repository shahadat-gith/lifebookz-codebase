# Realtime Booking Updates — Backend Contract & AWS Console Checklist

A new booking shows a live "waiting for expert response" screen; the expert
dashboard updates itself without refresh; confirmation flips the user's
screen to a **Pay** step. Transport: **AWS API Gateway WebSocket API +
Lambda** (no socket.io).

---

## 1. Wire protocol (application level)

Everything travels as JSON frames over one `wss://` connection.

**Client → Gateway** (routed by the `action` field):

```json
{ "action": "ping",          "at": 1717800000000 }
{ "action": "subscribe",     "consultationId": "cs_123" }
{ "action": "unsubscribe",   "consultationId": "cs_123" }
{ "action": "register",      "expertId": "ex_abc" }
```

**Lambda → Client** (pushed frames, consumed by both apps):

```json
{ "event": "consultation.confirmed",  "consultationId": "cs_123",
  "consultation": { "_id": "cs_123", "status": "CONFIRMED", "...": "..." } }
{ "event": "consultation.cancelled",  "consultationId": "cs_123" }
{ "event": "consultation.expired",    "consultationId": "cs_123" }
{ "event": "consultation.new",        "consultationId": "cs_123", "expertId": "ex_abc" }
```

Event names consumed today (mobile `src/api/realtime.ts` is generic — it
matches on `consultationId` — and the expert hook triggers a refetch on any
event):
- `consultation.confirmed` / `cancelled` / `expired` / `updated` / `new`

---

## 2. Lambda: how to push a frame to a connection

```js
import { ApiGatewayManagementApi, PostToConnectionCommand } from
  "@aws-sdk/client-apigatewaymanagement"; // v3

const mgmt = new ApiGatewayManagementApi({
  // apiId + stage come from the connect event's requestContext
  endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
});

await mgmt.send(new PostToConnectionCommand({
  ConnectionId: connectionId,
  Data: JSON.stringify({ event: "consultation.confirmed",
    consultationId, consultation }),
}));
```

Connection registry (DynamoDB recommended):

```
Table: lif_bookz_ws_connections
  PK: connectionId (S)
  attributes: expertId?, userId?, connectedAt (TTL attribute recommended)
GSI-1: expertId → find sockets to notify when an expert's consultations change
```

## 3. Recommended route → function mapping

| Route         | Lambda            | Purpose                                           |
|---------------|-------------------|---------------------------------------------------|
| `$connect`    | ws-connect        | store connectionId (+ auth JWT if you pass it)    |
| `$disconnect` | ws-disconnect     | delete connectionId from the registry             |
| `subscribe`   | ws-subscribe      | map consultationId ↔ connectionIds (or no-op if the broadcast set is derived from the registry) |
| `unsubscribe` | ws-subscribe      | remove the mapping                                |
| `register`    | ws-register       | tag connection with expertId                      |
| `ping`        | ws-ping           | return same frame to keep the socket warm         |

## 4. Emit points (inside the existing consultation Lambdas)

- `POST /consultations/requests` → after the record is **PENDING**, push
  `consultation.new` to sockets tagged with that `expertId`.
- Expert confirms (dashboard action) → push `consultation.confirmed` to
  sockets subscribed to that consultation.
- Cancel/expiry anywhere → push matching event.

## 5. AWS Console checklist (step by step)

1. **API Gateway → Create API → WebSocket API**
   - Name: `lifebookz-realtime`, Route selection expression: `action`
   - Confirm region = your backend's region.
2. **Create 6 routes**: `$connect`, `$disconnect`, `subscribe`,
   `unsubscribe`, `register`, `ping` — integrate all with Lambda.
3. **IAM**: the router lambdas need `dynamodb:*` on the connection table;
   any Lambda pushing frames needs `execute-api:Invoke`/`PostToConnection`
   on the API's ARN:
   `arn:aws:execute-api:<region>:<account>:<api-id>/<stage>/POST/@connections/*`
4. **Deploy** → new stage `prod`. Note the **wss:// invoke URL**
   (`…execute-api.<region>.amazonaws.com/prod`) — this is the value you
   export.
5. **Environment variables**:
   - Backend/Lambda: whatever names you use for the table/API id.
   - Mobile `.env`: `EXPO_PUBLIC_WS_URL=wss://…/prod`
   - Expert portal `.env`: `VITE_WS_URL=wss://…/prod`
6. **Test from the console**: Connections tab → after a client connects,
   use the "Send message" box with:
   `{"action":"ping"}` — expect an echo frame.
7. **Limits/good practice**: connection TTL via
   `PostToConnection` errors → prune dead rows; keep frames small; the
   API-level 2KB limit only applies to frames, not your business payloads.
