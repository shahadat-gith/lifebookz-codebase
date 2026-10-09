import Razorpay from "razorpay";
import config from "../config/index.js";
import { logger } from "./logger.service.js";

import { publishToConsultation } from "./realtime.service.js";
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
  PAYABLE_STATUSES,
} from "../utils/consultation.js";
import { validationError, serviceUnavailableError } from "../utils/errors.js";

import Payment from "../models/Payment.js";
import Consultation from "../models/Consultation.js";

let client = null;

function razorpayClient() {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw serviceUnavailableError(
      "Payments are not configured on this server. Please try again later.",
    );
  }

  if (!client) {
    client = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }

  return client;
}

/** Public checkout configuration (no secret material). */
export function checkoutConfig() {
  return {
    provider: "razorpay",
    configured: Boolean(config.razorpay.keyId && config.razorpay.keySecret),
    keyId: config.razorpay.keyId || null,
    currency: "INR",
  };
}

/**
 * Creates (or re-opens) the Razorpay order for a consultation and records
 * it in the Payment collection.
 *
 * The amount ALWAYS comes from the consultation record (set when the expert
 * accepted), never from the request body. Idempotent: an existing unpaid
 * order is returned as-is so re-opening the checkout never creates stray
 * orders (or double charges).
 */
export async function createOrderForConsultation({ consultation, userId }) {
  if (!userId) throw validationError("Authentication required.");

  const existing = await Payment.findOne({
    consultation: consultation._id,
    status: "created",
  });
  if (existing) {
    return {
      keyId: config.razorpay.keyId,
      orderId: existing.orderId,
      amount: existing.amount,
      currency: existing.currency,
    };
  }

  const order = await createOrder({ consultation });

  await Payment.create({
    consultation: consultation._id,
    user: userId,
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
    status: "created",
  });

  return order;
}

/**
 * Verifies the checkout signature server-side and marks the Payment paid.
 * Returns the payment document. Idempotent: the same payment verified twice
 * (or racing with the webhook) resolves to exactly one winner.
 */
export async function verifyPaymentForConsultation({
  consultationId,
  userId,
  orderId,
  paymentId,
  signature,
}) {
  if (!userId) throw validationError("Authentication required.");

  const verified = verifyCheckout({ orderId, paymentId, signature });

  const payment = await Payment.findOne({
    consultation: consultationId,
    user: userId,
    orderId: verified.orderId,
  });
  if (!payment) {
    throw validationError("This payment does not belong to this consultation.");
  }

  // Idempotent success.
  if (payment.status === "paid" && payment.paymentId === verified.paymentId) {
    return payment;
  }

  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "paid" } },
    {
      $set: {
        paymentId: verified.paymentId,
        signature: verified.signature,
        status: "paid",
        paidAt: new Date(),
      },
    },
    { new: true },
  );

  if (!updated) {
    throw validationError("This payment could not be verified. Please try again.");
  }

  // Live ping: the booking list and any waiting screen flip from "Pay now"
  // to "Join now" the second the payment lands — no refresh needed.
  publishToConsultation(consultationId, {
    event: "consultation.updated",
    consultationId,
    consultation: { _id: consultationId, status: null, paid: true },
  }).catch(() => {});

  return updated;
}

/**
 * "Has this consultation been paid?" — the single source of truth. Legacy
 * consultations that carried the old embedded payment subdoc are honoured
 * so no data migration is required.
 */
export async function hasPaidPayment(consultation) {
  if (consultation.payment?.paid || consultation.payment?.status === "paid") {
    return true;
  }
  if (consultation.amount === 0) return true;

  const paid = await Payment.findOne({
    consultation: consultation._id,
    status: "paid",
  }).select("_id");
  return Boolean(paid);
}

/**
 * Razorpay server-to-server webhook. `rawBody` must be the exact bytes
 * Razorpay signed (express.raw on the route). Safe to replay: decisions are
 * derived from stored state, never from the event payload alone.
 */
export async function handleWebhook({ rawBody, signature }) {
  if (!verifyWebhook(rawBody, signature)) {
    throw validationError("Invalid webhook signature.");
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw validationError("Malformed webhook payload.");
  }

  const type = event?.event;
  const entity = event?.payload?.payment?.entity;

  if (!type || !entity?.order_id) {
    return { handled: false };
  }

  const payment = await Payment.findOne({ orderId: entity.order_id });
  if (!payment) {
    // Unknown order — acknowledge so Razorpay stops retrying.
    logger.warn("Webhook for unknown order", {
      orderId: entity.order_id,
      event: type,
    });
    return { handled: false };
  }

  if (type === "payment.captured" || type === "order.paid") {
    if (payment.status === "paid") return { handled: true, action: "ignore" };

    // The consultation must still be payable for the payment to apply.
    const consultation = await Consultation.findById(payment.consultation).select(
      "status",
    );
    if (!consultation || !PAYABLE_STATUSES.includes(consultation.status)) {
      logger.warn("Webhook for a non-payable consultation — ignored", {
        orderId: entity.order_id,
        status: consultation?.status,
      });
      return { handled: false };
    }

    await Payment.updateOne(
      { _id: payment._id, status: { $ne: "paid" } },
      {
        $set: {
          paymentId: entity.id || payment.paymentId,
          status: "paid",
          paidAt: new Date(entity.created_at ? entity.created_at * 1000 : Date.now()),
        },
      },
    );
    // Live ping on the webhook path too (covers a dropped checkout tab).
    publishToConsultation(String(payment.consultation), {
      event: "consultation.updated",
      consultationId: String(payment.consultation),
      consultation: { _id: String(payment.consultation), status: null, paid: true },
    }).catch(() => {});
    return { handled: true, action: "markPaid" };
  }

  if (type === "payment.failed") {
    if (payment.status !== "created") return { handled: true, action: "ignore" };

    await Payment.updateOne(
      { _id: payment._id, status: "created" },
      {
        $set: {
          status: "failed",
          failedAt: new Date(),
          failureReason: entity.error_description || "Payment failed.",
        },
      },
    );
    return { handled: true, action: "markFailed" };
  }

  return { handled: false };
}

/**
 * Creates the Razorpay order itself.
 *
 * The amount ALWAYS comes from the consultation record (set when the expert
 * accepted), never from the request body.
 */
export async function createOrder({ consultation }) {
  try {
    const order = await razorpayClient().orders.create({
      amount: consultation.amount,
      currency: consultation.currency || "INR",
      receipt: `consult_${consultation.id}`,
      notes: {
        consultationId: consultation.id,
        userId: String(consultation.user?._id || consultation.user),
        expertId: String(consultation.expert?._id || consultation.expert),
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      // The checkout needs the public key id.
      keyId: config.razorpay.keyId,
    };
  } catch (error) {
    logger.error("Failed to create Razorpay order", {
      consultationId: consultation.id,
      reason: error?.error?.description || error.message,
    });
    throw serviceUnavailableError(
      "Could not start the payment. Please try again in a moment.",
    );
  }
}

/**
 * Verifies the checkout handshake. Returns the verified identifiers, or
 * throws — the payment is only marked after this passes.
 */
export function verifyCheckout({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) {
    throw validationError(
      "Payment verification requires order id, payment id and signature.",
    );
  }

  const ok = verifyPaymentSignature({
    orderId,
    paymentId,
    signature,
    secret: config.razorpay.keySecret,
  });

  if (!ok) {
    throw validationError("Payment verification failed. Please contact support.");
  }

  return { orderId, paymentId, signature };
}
