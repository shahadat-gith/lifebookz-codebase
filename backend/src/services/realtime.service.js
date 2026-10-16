import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import {
  ApiGatewayManagementApi,
  PostToConnectionCommand,
  GoneException,
} from "@aws-sdk/client-apigatewaymanagementapi";

import { config } from "../config/index.js";
import { logger } from "./logger.service.js";

// Registry table + attribute names live in config (aws.ws / aws.dynamodb),
// so every deployment knob is in one place.

/**
 * Realtime fan-out — pushes JSON frames to browsers/mobile apps connected
 * to the LifeBookz WebSocket API (API Gateway WebSocket + a DynamoDB
 * connection registry maintained by its $connect/$disconnect/subscribe/
 * register Lambdas).
 *
 * Frames mirror the client contract (docs/realtime-websocket-backend.md):
 *   { event: "consultation.completed", consultationId, consultation }
 *
 * The registry table (one row per live connection) is expected to carry:
 *   - connectionId (primary key)
 *   - consultationId  OR  consultationIds (a list) — set by `subscribe`
 *   - expertId — set by `register`
 * Attribute names are configurable (WS_ATTR_* env → config.aws.ws) so the
 * mapping survives any reasonable registry layout without code changes.
 *
 * Everything here is best-effort and fire-and-forget: a push failure NEVER
 * fails the business operation that triggered it (clients also poll).
 */

const CONNECTIONS_TABLE = config.aws.dynamodb.connectionsTable;
const ATTR_CONSULTATION = config.aws.ws.attrConsultation;
const ATTR_CONSULTATIONS = config.aws.ws.attrConsultations;
const ATTR_EXPERT = config.aws.ws.attrExpert;

let docClient = null;
let mgmt = null;
let warned = false;

function clients() {
  const endpoint = config.aws.ws.endpoint;
  if (!endpoint) {
    if (!warned) {
      warned = true;
      logger.info(
        "WS_API_ENDPOINT not configured — realtime pushes are disabled (clients fall back to polling).",
      );
    }
    return null;
  }
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: config.aws.region }),
    );
  }
  if (!mgmt) {
    mgmt = new ApiGatewayManagementApi({
      region: config.aws.region,
      endpoint,
    });
  }
  return { docClient, mgmt };
}

async function postToConnection(mgmtClient, connectionId, frame) {
  try {
    await mgmtClient.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(frame),
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof GoneException || err?.name === "GoneException") {
      // Stale connection — prune it so future scans stay small.
      try {
        await docClient.send(
          new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId },
          }),
        );
      } catch {
        /* pruning is best-effort */
      }
      return false;
    }
    logger.warn("WS push failed", { connectionId, error: err?.message });
    return false;
  }
}

/** Scan the registry for connections matching `filterExpr` + `values`. */
async function findConnections(filterExpr, values) {
  const c = clients();
  if (!c) return [];
  try {
    const result = await c.docClient.send(
      new ScanCommand({
        TableName: CONNECTIONS_TABLE,
        FilterExpression: filterExpr,
        ExpressionAttributeValues: values,
        ProjectionExpression: "connectionId",
      }),
    );
    return (result.Items || [])
      .map((item) => item.connectionId)
      .filter(Boolean);
  } catch (err) {
    logger.warn("WS registry scan failed", { error: err?.message });
    return [];
  }
}

/**
 * Push a frame to every live connection subscribed to a consultation
 * (`subscribe` route wrote the consultationId / consultationIds attribute).
 */
export async function publishToConsultation(consultationId, frame) {
  if (!consultationId) return;
  const connectionIds = await findConnections(
    `${ATTR_CONSULTATION} = :cid OR contains(${ATTR_CONSULTATIONS}, :cid)`,
    { ":cid": String(consultationId) },
  );
  await deliver(connectionIds, frame);
}

/**
 * Push a frame to every live connection registered for an expert
 * (`register` route wrote the expertId attribute) — used for
 * `consultation.new` on new booking requests.
 */
export async function publishToExpert(expertId, frame) {
  if (!expertId) return;
  const connectionIds = await findConnections(`${ATTR_EXPERT} = :eid`, {
    ":eid": String(expertId),
  });
  await deliver(connectionIds, frame);
}

async function deliver(connectionIds, frame) {
  if (connectionIds.length === 0) return;
  const c = clients();
  if (!c) return;
  await Promise.allSettled(
    connectionIds.map((connectionId) =>
      postToConnection(c.mgmt, connectionId, frame),
    ),
  );
}
