import { Router } from "express";

import { authenticate, authorize } from "../middleware/auth.js";
import * as consult from "../controllers/consultations.controller.js";

const router = Router();


// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------
router.post(
  "/match",
  authenticate,
  authorize("user"),
  consult.matchExperts,
);


// ---------------------------------------------------------------------------
// User endpoints — `authorize("user")` keeps authors/experts/admins out.
// ---------------------------------------------------------------------------
router.post(
  "/requests",
  authenticate,
  authorize("user"),
  consult.createRequest,
);

router.get("/mine", authenticate, authorize("user"), consult.listMine);

// ---------------------------------------------------------------------------
// Expert endpoints
// ---------------------------------------------------------------------------
router.get("/expert", authenticate, authorize("expert"), consult.listForExpert);

router.post(
  "/:consultationId/accept",
  authenticate,
  authorize("expert"),
  consult.accept,
);

router.post(
  "/:consultationId/decline",
  authenticate,
  authorize("expert"),
  consult.decline,
);

// ---------------------------------------------------------------------------
// Shared participant endpoints (user OR expert — role checked in service)
// ---------------------------------------------------------------------------
router.get(
  "/:consultationId",
  authenticate,
  authorize("user", "expert"),
  consult.getOne,
);

router.post(
  "/:consultationId/cancel",
  authenticate,
  authorize("user", "expert"),
  consult.cancel,
);


// Video session (both sides)
router.get(
  "/:consultationId/session",
  authenticate,
  authorize("user", "expert"),
  consult.getSession,
);

// Dedicated consult portal entry point — same authorization and Chime
// machinery as `/session`, trimmed to what a live-session page needs.
router.get(
  "/:consultationId/join",
  authenticate,
  authorize("user", "expert"),
  consult.join,
);

router.post(
  "/:consultationId/session/join",
  authenticate,
  authorize("user", "expert"),
  consult.joinSession,
);

router.post(
  "/:consultationId/session/heartbeat",
  authenticate,
  authorize("user", "expert"),
  consult.heartbeat,
);

router.post(
  "/:consultationId/session/end",
  authenticate,
  authorize("user", "expert"),
  consult.endSession,
);

// ---------------------------------------------------------------------------
// Cross-subdomain session handoff (moves an existing portal session onto
// the consultations portal — a consultations concern, not an auth one)
// ---------------------------------------------------------------------------

// A still-valid portal token is traded for a one-time ticket. The token is
// verified server-side; nothing from the request body is trusted as identity.
router.post("/handoff", consult.createHandoff);

// The one-time ticket becomes a regular JWT for the consultations portal.
router.post("/handoff/exchange", consult.exchangeHandoff);

// ---------------------------------------------------------------------------
// Rating (user side)
// ---------------------------------------------------------------------------
router.post(
  "/:consultationId/rating",
  authenticate,
  authorize("user"),
  consult.rate,
);

export default router;
