import { Router } from "express";

import { authenticate, authorize } from "../middleware/auth.js";
import * as payment from "../controllers/payment.controller.js";

const router = Router();

// ---------------------------------------------------------------------------
// Webhook — signature IS the authentication. Raw body only (see app.js):
// must be registered before any JSON-parsed route would consume the stream.
// ---------------------------------------------------------------------------
router.post("/webhook", payment.webhook);

// Public checkout configuration (key id, no secret material).
router.get("/config", authenticate, authorize("user"), payment.checkoutConfig);

// Resource-generic payment flow (user only). Today the only resource is
// "consultation"; new payable resources are added in the controller's
// RESOURCES registry — these URLs stay stable.
router.get(
  "/:resource/:resourceId/state",
  authenticate,
  authorize("user"),
  payment.paymentState,
);

router.post(
  "/order/:resource/:resourceId",
  authenticate,
  authorize("user"),
  payment.createOrder,
);

router.post("/verify/:resource", authenticate, authorize("user"), payment.verify);

export default router;
