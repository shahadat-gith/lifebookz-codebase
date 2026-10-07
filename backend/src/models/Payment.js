import mongoose from "mongoose";

/**
 * Payment — one document per Razorpay order, fully decoupled from the
 * Consultation. The consultation stores nothing about money anymore; "has
 * this consultation been paid for?" is answered by querying here.
 *
 * Lifecycle: created (order opened) → paid (verified) | failed.
 * `orderId` has a unique partial index so Razorpay webhooks can reconcile
 * by order id and duplicate orders are impossible.
 */
const paymentSchema = new mongoose.Schema(
  {
    consultation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Consultation",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    provider: { type: String, default: "razorpay" },

    // Razorpay identifiers, stored for reconciliation with the dashboard.
    orderId: { type: String, required: true, trim: true },
    paymentId: { type: String, trim: true, default: "" },
    signature: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },

    amount: { type: Number, min: 0, required: true }, // paise
    currency: { type: String, default: "INR" },

    paidAt: { type: Date },
    failedAt: { type: Date },
    failureReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

paymentSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { orderId: { $gt: "" } } },
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
