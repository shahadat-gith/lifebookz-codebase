import dotenv from "dotenv";
dotenv.config();

// Env values pasted into cloud consoles often arrive wrapped in quotes or
// padded with whitespace — both silently corrupt AWS signatures.
const cleanEnv = (value) =>
  typeof value === "string" ? value.trim().replace(/^["']+|["']+$/g, "") : value;

export const config = {
  env: process.env.NODE_ENV || "dev",
  port: parseInt(process.env.PORT, 10) || 5000,

  database: {
    url: process.env.MONGODB_URI,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
  },

  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    key: process.env.ADMIN_KEY,
  },

  developer: {
    email: process.env.DEVELOPER_EMAIL,
    password: process.env.DEVELOPER_PASSWORD,
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    endpoint: process.env.R2_ENDPOINT,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  },

  // Everything AWS lives here. Credentials use the standard AWS SDK env
  // names (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY), which every AWS SDK
  // v3 client also picks up automatically via its default provider chain.
  aws: {
    // Region for SES and (by default) Chime meetings.
    region: process.env.AWS_REGION || process.env.SES_REGION || "ap-south-1",
    accessKeyId: cleanEnv(process.env.AWS_ACCESS_KEY_ID),
    secretAccessKey: cleanEnv(process.env.AWS_SECRET_ACCESS_KEY),
    // Only needed for temporary (STS/SSO) credentials.
    sessionToken: cleanEnv(process.env.AWS_SESSION_TOKEN),

    ses: {
      fromName: process.env.SES_FROM_NAME || "Lifebookz",
      fromMail: process.env.SES_FROM_EMAIL || "noreply@lifebookz.com",
    },

    chime: {
      // AWS media region where Chime meetings are hosted (Mumbai for India).
      mediaRegion: process.env.CHIME_MEDIA_REGION || "ap-south-1",
    },

    // Realtime fan-out (API Gateway WebSocket). Pushes are DISABLED until
    // `endpoint` is set — clients fall back to polling.
    ws: {
      // Example: https://53bt496mv6.execute-api.ap-south-1.amazonaws.com/prod
      endpoint: process.env.WS_API_ENDPOINT,
      // DynamoDB connection registry maintained by the WS $connect/
      // subscribe/register Lambdas.
      connectionsTable:
        process.env.WS_CONNECTIONS_TABLE || "lif_bookz_ws_connections",
      // Registry attribute names (configurable so the service survives any
      // reasonable table layout without code changes).
      attrConsultation: process.env.WS_ATTR_CONSULTATION || "consultationId",
      attrConsultations: process.env.WS_ATTR_CONSULTATIONS || "consultationIds",
      attrExpert: process.env.WS_ATTR_EXPERT || "expertId",
    },

    // Direct DynamoDB access (currently only the WS connection registry).
    dynamodb: {
      region: process.env.AWS_REGION || process.env.SES_REGION || "ap-south-1",
      // The WS connection registry — kept here as the single place that
      // names it, in case more tables join later.
      connectionsTable:
        process.env.WS_CONNECTIONS_TABLE || "lif_bookz_ws_connections",
    },
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  consult: {
    // How long an unanswered request stays PENDING before it expires.
    requestTtlHours: parseInt(process.env.CONSULT_REQUEST_TTL_HOURS, 10) || 48,
    // An IN_PROGRESS session is force-completed when BOTH heartbeats are
    // quiet for this long (participants reconnecting stay unaffected).
    sessionStaleMinutes: parseInt(process.env.CONSULT_SESSION_STALE_MINUTES, 10) || 10,
    // A PENDING request the expert never confirmed auto-cancels after this
    // long; clients show their "getting late" nudge at ~2 min against the
    // same deadline received in each consultation payload.
    confirmTimeoutMin: parseInt(process.env.CONSULT_CONFIRM_TIMEOUT_MIN, 10) || 5,
  },  frontend: {
    admin: process.env.FRONTEND_ADMIN_URL,
    client: process.env.FRONTEND_CLIENT_URL,
    author: process.env.FRONTEND_AUTHOR_URL,
    expert: process.env.FRONTEND_EXPERT_URL,
    developer: process.env.FRONTEND_DEVELOPER_URL,
    // Dedicated live-session portal (session.lifebookz.com).
    session: process.env.FRONTEND_SESSION_URL,
    // Dedicated payment portal (payment.lifebookz.com) — pay-at-the-door
    // checkout for every payable resource.
    payment: process.env.FRONTEND_PAYMENT_URL,
  },
};

export default config;
