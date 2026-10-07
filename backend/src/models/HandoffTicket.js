import mongoose from "mongoose";

/**
 * Single-use, short-lived tickets that hand a signed-in LifeBookz session
 * across subdomains (lifebookz.com → consult.lifebookz.com).
 *
 * The client and expert portals already hold a JWT in localStorage, which is
 * origin-scoped and cannot travel to the consult subdomain. Instead of a
 * second auth system, the portal redeems a ticket: it mints a one-time code
 * bound to its own account and the consult app swaps it for a fresh JWT from
 * the SAME signing secret. One credential store, one token format, one
 * middleware — nothing new to trust.
 */
const handoffTicketSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // The account that may redeem the ticket (`role` selects the account
    // type — the same discriminator `authenticate` uses on tokens).
    accountId: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["user", "author", "expert"],
    },
    // Consumed on first use; redemption is atomic (findOneAndUpdate).
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Mongo removes expired tickets on its own — no sweep needed.
handoffTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("HandoffTicket", handoffTicketSchema);
