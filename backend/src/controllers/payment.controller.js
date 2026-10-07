import * as paymentService from "../services/payment.service.js";
import * as consultationsService from "../services/consultations.service.js";
import config from "../config/index.js";

/**
 * Payment resources.
 *
 * The payment portal is deliberately resource-generic
 * (`/payments/order/:resource/:resourceId`): today the only payable resource
 * is a consultation, but subscriptions, courses, etc. plug in by adding a
 * resolver here — the portal's URLs and UI never change.
 *
 * Each resolver owns the whole vertical slice for its resource:
 *   load    → fetch + authorize the caller against the resource
 *   payable → may this resource be paid for right now?
 *   createOrder / verify / hasPaid → delegated to the right service paths
 */
const RESOURCES = {
  consultation: {
    async load({ resourceId, userId }) {
      // Participant-only read; throws 404 for anyone else's consultation.
      return consultationsService.getForParticipant({
        id: resourceId,
        userId,
        role: "user",
      });
    },
    payable(consultation) {
      return consultation.status === "CONFIRMED";
    },
    async createOrder({ resource, userId }) {
      return paymentService.createOrderForConsultation({
        consultation: resource,
        userId,
      });
    },
    async verify({ resourceId, userId, handshake }) {
      return paymentService.verifyPaymentForConsultation({
        consultationId: resourceId,
        userId,
        ...handshake,
      });
    },
    async hasPaid({ resource }) {
      return paymentService.hasPaidPayment(resource);
    },
    /** Where the paid user goes next — the session room. */
    successUrl(resourceId) {
      const session = (config.frontend.session || "").replace(/\/$/, "");
      return session ? `${session}/session/${resourceId}` : null;
    },
  },
};

function resolveResource(name) {
  const resource = RESOURCES[name];
  if (!resource) {
    const error = new Error(`Unknown payment resource "${name}".`);
    error.statusCode = 404;
    error.code = "NOT_FOUND";
    error.isAppError = true;
    throw error;
  }
  return resource;
}

// ---------------------------------------------------------------------------

/**
 * GET /payments/config — public checkout configuration (key id, no secrets).
 */
export async function checkoutConfig(_req, res, next) {
  try {
    return res.json({ success: true, data: paymentService.checkoutConfig() });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /payments/:resource/:resourceId/state — what the payment portal needs
 * to render: paid or not, the amount, and where to go once paid. Amount and
 * paid state ALWAYS come from the backend, never the URL or the client.
 */
export async function paymentState(req, res, next) {
  try {
    const resource = resolveResource(req.params.resource);
    const doc = await resource.load({
      resourceId: req.params.resourceId,
      userId: req.user?.id,
    });

    const paid = await resource.hasPaid({ resource: doc });
    const payable = resource.payable(doc);

    return res.json({
      success: true,
      data: {
        resource: req.params.resource,
        resourceId: req.params.resourceId,
        paid,
        payable,
        amount: doc.amount,
        currency: doc.currency || "INR",
        status: doc.status,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /payments/order/:resource/:resourceId — user only.
 * Creates (or re-opens) the Razorpay order for the resource.
 */
export async function createOrder(req, res, next) {
  try {
    const resource = resolveResource(req.params.resource);
    const doc = await resource.load({
      resourceId: req.params.resourceId,
      userId: req.user?.id,
    });

    if (!resource.payable(doc)) {
      return res.status(409).json({
        success: false,
        error: {
          code: "CONFLICT_ERROR",
          message: "Only a confirmed consultation can be paid for.",
        },
      });
    }

    const order = await resource.createOrder({
      resource: doc,
      userId: req.user?.id,
    });

    return res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /payments/verify/:resource — user only.
 * Verifies the Razorpay checkout signature server-side, then marks the
 * payment paid. Returns where the user should be sent next.
 */
export async function verify(req, res, next) {
  try {
    const resource = resolveResource(req.params.resource);
    const payment = await resource.verify({
      resourceId: req.body.resourceId,
      userId: req.user?.id,
      handshake: {
        orderId: req.body.razorpay_order_id,
        paymentId: req.body.razorpay_payment_id,
        signature: req.body.razorpay_signature,
      },
    });

    return res.json({
      success: true,
      data: {
        resourceId: payment.consultation,
        redirectUrl: resource.successUrl(String(payment.consultation)),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /payments/webhook — Razorpay server-to-server events.
 * Consumes the RAW body for signature verification (mounted before the JSON
 * parser in app.js). No authentication — the signature is the auth.
 */
export async function webhook(req, res, next) {
  try {
    const result = await paymentService.handleWebhook({
      rawBody: req.body, // Buffer, thanks to express.raw on this route
      signature: req.headers["x-razorpay-signature"],
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
