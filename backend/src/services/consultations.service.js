import crypto from "node:crypto";
import mongoose from "mongoose";

import User from "../models/User.js";
import Consultation from "../models/Consultation.js";
import HandoffTicket from "../models/HandoffTicket.js";
import Payment from "../models/Payment.js";
import { generateToken, flattenUser, withId } from "../utils/helpers.js";
import { CONSULT_CATEGORY_IDS } from "../constants/expert.constants.js";
import config from "../config/index.js";
import { logger } from "./logger.service.js";
import {
  sendBookingRequestMail,
  sendBookingStatusMail,
} from "./mailer.service.js";
import * as paymentService from "./payment.service.js";
import { ensureChimeSession, deleteChimeMeeting } from "./chime.service.js";
import {
  publishToConsultation,
  publishToExpert,
} from "./realtime.service.js";

import {
  authenticationError,
  conflictError,
  forbiddenError,
  notFoundError,
  validationError,
} from "../utils/errors.js";

import {
  BUSY_STATUSES,
  CONSULTATION_STATUSES,
  PAYABLE_STATUSES,
  buildExpertOccupiedFilter,
  isSessionStale,
  lastActivityAt,
  sessionDurationSeconds,
} from "../utils/consultation.js";

// Fields the consult results cards need.
const EXPERT_SELECT = "fullName avatar expert";

const MIN_PROBLEM_LENGTH = 10;

const FREE_AMOUNT = 0;

/**
 * The room link emailed to the user once the expert confirms.
 *
 * The full, resource-aware join journey: the payment portal first (pay at
 * the door), which then forwards to the consultations portal's live room.
 */
export function roomUrlFor(consultationId) {
  const payment = (config.frontend.payment || "").replace(/\/$/, "");
  if (payment) return `${payment}/pay/consultation/${consultationId}`;

  // Fallback: the consultations portal itself (it redirects unpaid users to
  // the payment portal when FRONTEND_PAYMENT_URL is not set).
  const consult = (config.frontend.session || "").replace(/\/$/, "");
  if (consult) return `${consult}/session/${consultationId}`;

  const client = (config.frontend.client || "").replace(/\/$/, "");
  return `${client}/consult/${consultationId}/session`;
}

// ---------------------------------------------------------------------------
// Cross-subdomain session handoff
// ---------------------------------------------------------------------------

/**
 * The consultations portal is a separate subdomain, so a session created in
 * the client or expert portal (JWT in localStorage — origin-scoped) cannot
 * reach it directly. Handoff bridges that: the closing portal trades its own
 * still-valid bearer token for a one-time, short-lived ticket; the room page
 * exchanges the ticket for a fresh JWT signed with the SAME secret and
 * resolved by the SAME `authenticate` middleware. One credential format —
 * no second auth system, no shared cookies.
 */

const HANDOFF_ROLES = ["user", "author", "expert"];

/**
 * Mint a handoff ticket for the caller. The portal sends its own token; we
 * verify it through the standard models — nothing from the request body is
 * trusted as identity.
 */
export async function createHandoffTicket({ token }) {
  if (!token) throw authenticationError("A session token is required.");

  const { default: jwt } = await import("jsonwebtoken");
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch {
    throw authenticationError("Invalid or expired token.");
  }

  const role = decoded.role;
  if (!HANDOFF_ROLES.includes(role)) {
    throw forbiddenError("This account type cannot open a consultation room.");
  }

  const accountId = decoded.userId;
  if (!accountId) throw authenticationError("Invalid token.");

  // The account must still exist and be active — a stale token cannot mint
  // a ticket.
  const account = await User.findById(accountId).select("_id status");
  if (!account) throw notFoundError("Account not found.");
  if (account.status && account.status !== "active") {
    throw forbiddenError("This account is not active.");
  }

  const code = crypto.randomBytes(32).toString("hex");
  const ttlMinutes = parseInt(process.env.HANDOFF_TICKET_TTL_MINUTES, 10) || 2;

  await HandoffTicket.create({
    code,
    accountId: String(account._id),
    role,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
  });

  return { code };
}

/**
 * The token always carries the account's CURRENT role, resolved from the
 * user table — the role captured when the ticket was minted may have
 * changed (e.g. the account upgraded to expert since).
 */
async function resolveTicketRole(ticket) {
  const account = await User.findById(ticket.accountId).select("role").lean();
  return account?.role || ticket.role;
}

/**
 * Exchange a one-time ticket for a fresh JWT. Atomic consumption: only the
 * first redemption wins; a replayed code fails with 401. The token is built
 * exactly like a normal login token, so existing middleware handles it.
 */
export async function exchangeHandoffTicket({ code }) {
  if (!code) throw authenticationError("A handoff code is required.");

  const ticket = await HandoffTicket.findOneAndUpdate(
    { code, consumedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true },
  );

  if (!ticket) {
    throw authenticationError("This sign-in link is invalid, used, or expired.");
  }

  const role = await resolveTicketRole(ticket);

  return {
    token: generateToken({ role, userId: ticket.accountId }),
    role,
  };
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

let transactionsSupported = true;

/**
 * Runs `fn` inside a MongoDB transaction with brief retries on write
 * conflicts. On deployments without replica-set transactions (some local
 * setups) it falls back to running `fn` directly — the services then rely on
 * atomic update conditions for safety, which they always do anyway.
 */
export async function runInTransaction(fn) {
  // No live connection (unit tests, tooling) → run directly; the atomic
  // update conditions below carry the safety on their own.
  if (mongoose.connection.readyState !== 1) return fn(null);
  if (!transactionsSupported) return fn(null);

  try {
    return await mongoose.connection.transaction(fn, {
      readPreference: "primary",
      readConcern: { level: "local" },
      writeConcern: { w: "majority" },
    });
  } catch (error) {
    if (/Transaction numbers are only allowed/i.test(error?.message || "")) {
      transactionsSupported = false;
      logger.warn("MongoDB transactions unavailable — falling back to atomic updates.");
      return fn(null);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Lazy sweeps — no cron needed on Lambda; every relevant endpoint sweeps.
// ---------------------------------------------------------------------------

/**
 * Expires requests nobody accepted, and force-completes abandoned
 * IN_PROGRESS sessions. Cheap, indexed, idempotent.
 */
export async function expireStaleConsultations() {
  const now = new Date();
  const staleSessionMs = config.consult.sessionStaleMinutes * 60 * 1000;

  // Requests the expert never confirmed within the confirm-timeout window
  // (5 min by default) — cancel them so the user isn't left hanging. This
  // is server-side and timer-independent of any client screen: closing the
  // app, clicking back, or losing the socket never affects the deadline.
  const confirmDeadline = new Date(
    now.getTime() - config.consult.confirmTimeoutMin * 60 * 1000,
  );
  const unconfirmed = await Consultation.find({
    status: "PENDING",
    createdAt: { $lt: confirmDeadline },
  })
    .select("_id expert user")
    .lean();

  let autoCancelled = 0;
  for (const doc of unconfirmed) {
    const cancelled = await Consultation.findOneAndUpdate(
      { _id: doc._id, status: "PENDING" },
      {
        $set: {
          status: "CANCELLED",
          cancelledBy: "system",
          cancelReason: "Expert did not confirm the session in time.",
        },
      },
      { new: true },
    );
    if (!cancelled) continue;
    autoCancelled += 1;

    // Fire-and-forget: the user's bookings/waiting screens learn the
    // booking was cancelled the moment the sweep lands it.
    publishToConsultation(String(doc._id), {
      event: "consultation.cancelled",
      consultationId: String(doc._id),
      consultation: { _id: String(doc._id), status: "CANCELLED" },
      reason: "Expert did not confirm the session in time.",
    }).catch(() => {});
  }

  // Requests that no expert accepted in time.
  const expiredRequests = await Consultation.updateMany(
    { status: "PENDING", requestExpiresAt: { $lt: now } },
    { $set: { status: "EXPIRED", cancelledBy: "system", cancelReason: "Request expired." } },
  );

  // Sessions both participants walked away from.
  const inProgress = await Consultation.find({ status: "IN_PROGRESS" })
    .select("session expert")
    .lean();

  let abandoned = 0;
  for (const doc of inProgress) {
    if (!isSessionStale(doc.session, staleSessionMs, now.getTime())) continue;

    const endedAt = lastActivityAt(doc.session);
    await Consultation.updateOne(
      { _id: doc._id, status: "IN_PROGRESS" },
      {
        $set: {
          status: "COMPLETED",
          "session.endedAt": endedAt,
          "session.durationSeconds": sessionDurationSeconds(doc.session.startedAt, endedAt),
        },
      },
    );
    await User.updateOne({ _id: doc.expert }, { $inc: { "expert.sessions": 1 } });
    abandoned += 1;
  }

  if (expiredRequests.modifiedCount || abandoned || autoCancelled) {
    logger.info("Consultation sweep", {
      expiredRequests: expiredRequests.modifiedCount,
      abandoned,
      autoCancelled,
    });
  }
}

// ---------------------------------------------------------------------------
// Discovery — only AVAILABLE experts are shown
// ---------------------------------------------------------------------------

/**
 * Approved experts for the described problem, ranked by rating.
 * Experts currently IN_PROGRESS (in a live session) are busy and are left
 * out. Experts can also take themselves off the list with the dashboard
 * availability switch (`isAvailable: false`). Availability is decided by
 * these two flags — nothing else.
 */
export async function matchExperts({ problem, category, limit }) {
  const cleanProblem = problem?.trim();
  const cleanCategory = category?.trim() || "";
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);

  if (!cleanProblem || cleanProblem.length < MIN_PROBLEM_LENGTH) {
    throw validationError(
      "Please describe your problem in at least 10 characters.",
    );
  }

  if (cleanCategory && !CONSULT_CATEGORY_IDS.includes(cleanCategory)) {
    throw validationError("Unknown consultancy category.");
  }

  const busyIds = await Consultation.find({ status: { $in: BUSY_STATUSES } })
    .distinct("expert");

  const query = {
    roles: "expert",
    status: "active",
    "expert.verification.status": "approved",
    "expert.isAvailable": { $ne: false },
    _id: { $nin: busyIds },
  };

  if (cleanCategory) query["expert.categories"] = cleanCategory;

  const experts = await User.find(query).select(EXPERT_SELECT).lean();

  experts.sort((a, b) => (b.expert?.rating || 0) - (a.expert?.rating || 0));

  return {
    experts: experts.slice(0, safeLimit).map(flattenUser),
    category: cleanCategory || null,
    matched: false,
  };
}

// ---------------------------------------------------------------------------
// Request creation (user)
// ---------------------------------------------------------------------------

export async function createConsultation({ user, input }) {
  const { expertId, problem, category, notes } = input;

  const cleanProblem = problem?.trim();
  const cleanCategory = category?.trim() || "";

  if (!user?.id) throw authenticationError("Authentication required.");
  if (!expertId) throw validationError("Please choose an expert to book.");
  if (!cleanProblem || cleanProblem.length < MIN_PROBLEM_LENGTH) {
    throw validationError(
      "Please describe your problem in at least 10 characters.",
    );
  }
  if (cleanCategory && !CONSULT_CATEGORY_IDS.includes(cleanCategory)) {
    throw validationError("Unknown consultancy category.");
  }

  const expert = await User.findOne({
    _id: expertId,
    roles: "expert",
    status: "active",
    "expert.verification.status": "approved",
  }).select("fullName email expert.price");

  if (!expert) {
    throw notFoundError("Expert not found or not available.");
  }

  const consultation = await Consultation.create({
    user: user.id,
    expert: expert._id,
    problem: cleanProblem,
    category: cleanCategory || undefined,
    notes: notes?.trim() || "",
    userName: user.fullName || "",
    userEmail: user.email || "",
    // Display price at request time; the binding amount is set on acceptance.
    amount: Math.round((expert.expert?.price || 0) * 100),
    currency: "INR",
    status: "PENDING",
    requestExpiresAt: new Date(Date.now() + config.consult.requestTtlHours * 60 * 60 * 1000),
  });

  // The expert is asked — by email — to open their dashboard and confirm or
  // reject. The problem travels with it.
  sendBookingRequestMail({
    to: expert.email,
    expertName: expert.fullName,
    clientName: user.fullName,
    clientEmail: user.email,
    problem: cleanProblem,
  });

  // Live ping: the expert's dashboard (and any socket registered for this
  // expert) learns about the new request instantly.
  publishToExpert(expert.id || expert._id, {
    event: "consultation.new",
    consultationId: consultation.id || consultation._id,
    expertId: String(expert.id || expert._id),
    consultation: { _id: consultation.id || consultation._id, status: "PENDING" },
  }).catch(() => {});

  return consultation;
}

// ---------------------------------------------------------------------------
// Reads (strictly participant-scoped)
// ---------------------------------------------------------------------------

function participantFilter(id, role, extra = {}) {
  return role === "expert" ? { expert: id, ...extra } : { user: id, ...extra };
}

/**
 * Sides the caller may resolve to, in priority order. A dual account
 * (author + expert) usually acts as the expert, but can still reach its
 * client-side bookings — the side is confirmed against the document.
 */
function sideCandidatesOf({ role, roles }) {
  const held = Array.isArray(roles) && roles.length > 0 ? roles : [role];

  if (held.includes("expert")) {
    return held.includes("user") ? ["expert", "user"] : ["expert"];
  }

  return ["user"];
}

/** Flatten the populated user/expert blocks (lean docs bypass toJSON). */
function flattenParticipants(consultation) {
  return withId({
    ...consultation,
    user: flattenUser(consultation.user),
    expert: flattenUser(consultation.expert),
  });
}

export async function listMine({ userId, role = "user", status, limit, page }) {
  if (!userId) throw authenticationError("Authentication required.");

  const extra = {};
  if (status && CONSULTATION_STATUSES.includes(status)) extra.status = status;

  // Server-side pagination: default 10 per page, hard-capped at 100 so a
  // hand-crafted query can never pull the whole history in one go.
  const lim = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  const pg = Math.max(Number.parseInt(page, 10) || 1, 1);
  const skip = (pg - 1) * lim;

  const filter = participantFilter(userId, role, extra);

  const [consultations, total] = await Promise.all([
    Consultation.find(filter)
      .populate("expert", "fullName avatar expert")
      .populate("user", "fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    Consultation.countDocuments(filter),
  ]);

  // The booking card needs to know paid vs unpaid to show "Join now" vs
  // "Pay now" (the lifecycle status alone can't tell — CONFIRMED covers
  // both). Payment docs live in their own collection (except legacy docs
  // with the embedded subdoc), so resolve them in one query for the page.
  const paymentConsultationIds = consultations
    .filter((c) => !(c.payment?.paid || c.payment?.status === "paid") && c.amount !== 0)
    .map((c) => c._id);

  const paidIds = new Set(
    paymentConsultationIds.length
      ? (
          await Payment.find({
            consultation: { $in: paymentConsultationIds },
            status: "paid",
          }).select("consultation").lean()
        ).map((p) => String(p.consultation))
      : [],
  );
  const confirmTimeoutMs = config.consult.confirmTimeoutMin * 60 * 1000;
  const withPaid = consultations.map((c) => ({
    ...c,
    paid:
      Boolean(c.payment?.paid) ||
      c.payment?.status === "paid" ||
      c.amount === 0 ||
      paidIds.has(String(c._id)),
    // Server deadline the client clocks run against — client timers are
    // presentation only and can never end a booking on their own.
    confirmDeadline:
      c.status === "PENDING" && c.createdAt
        ? new Date(new Date(c.createdAt).getTime() + confirmTimeoutMs).toISOString()
        : null,
  }));

  return {
    consultations: withPaid.map(flattenParticipants),
    total,
    page: pg,
    limit: lim,
    hasMore: skip + consultations.length < total,
  };
}

export async function getForParticipant({ id, role, roles, userId }) {
  if (!userId) throw authenticationError("Authentication required.");

  await expireStaleConsultations();

  let consultation = null;
  let side = "user";
  for (const candidate of sideCandidatesOf({ role, roles })) {
    consultation = await Consultation.findOne(
      participantFilter(userId, candidate, { _id: id }),
    )
      .populate("expert", "fullName avatar expert")
      .populate("user", "fullName avatar")
      .lean();
    if (consultation) {
      side = candidate;
      break;
    }
  }

  if (!consultation) throw notFoundError("Consultation not found.");

  // `paid` powers the card's Join vs Pay decision (and the waiting
  // screen's post-confirmation hop) — resolve the Payment collection
  // lookup exactly like listMine does.
  const paid =
    Boolean(consultation.payment?.paid) ||
    consultation.payment?.status === "paid" ||
    consultation.amount === 0 ||
    Boolean(
      await Payment.findOne({
        consultation: consultation._id,
        status: "paid",
      }).select("_id").lean(),
    );
  const confirmTimeoutMs = config.consult.confirmTimeoutMin * 60 * 1000;
  return {
    ...flattenParticipants(consultation),
    paid,
    confirmDeadline:
      consultation.status === "PENDING" && consultation.createdAt
        ? new Date(
            new Date(consultation.createdAt).getTime() + confirmTimeoutMs,
          ).toISOString()
        : null,
  };
}

// ---------------------------------------------------------------------------
// Expert decision — confirm or reject
// ---------------------------------------------------------------------------

/**
 * The expert confirms a PENDING request.
 *
 * Occupancy is enforced inside a transaction: the busy check (is the expert
 * IN_PROGRESS right now?) and the PENDING → CONFIRMED flip commit together,
 * so a busy expert can never take a second booking. On success the meeting
 * room exists and the user is emailed the join link.
 */
export async function acceptConsultation({ expertId, consultationId }) {
  if (!expertId) throw authenticationError("Authentication required.");

  await expireStaleConsultations();

  const expert = await User.findById(expertId).select("fullName expert.price");
  if (!expert) throw notFoundError("Expert not found.");

  const amount = Math.round((expert.expert?.price || 0) * 100);

  const confirmed = await runInTransaction(async (session) => {
    // 1. Lock the request: only a still-PENDING, unexpired one can flip.
    const consultation = await Consultation.findOneAndUpdate(
      {
        _id: consultationId,
        expert: expertId,
        status: "PENDING",
        $or: [
          { requestExpiresAt: { $gt: new Date() } },
          { requestExpiresAt: { $exists: false } },
        ],
      },
      {
        $set: {
          status: "CONFIRMED",
          amount,
          // Free consultations are already "paid".
          ...(amount <= FREE_AMOUNT
            ? {
                "payment.status": "paid",
                "payment.paidAt": new Date(),
                "payment.amount": 0,
                "payment.currency": "INR",
              }
            : {}),
        },
      },
      { new: true, ...(session ? { session } : {}) },
    );

    if (!consultation) {
      // Distinguish "not mine / not pending" from "expired".
      const existing = await Consultation.findOne(
        { _id: consultationId, expert: expertId },
        null,
        session ? { session } : {},
      ).lean();

      if (!existing) throw notFoundError("Consultation request not found.");
      if (existing.status === "EXPIRED" || existing.requestExpiresAt < new Date()) {
        throw conflictError("This request has expired.");
      }
      throw conflictError(`This request is already ${existing.status.toLowerCase()}.`);
    }

    // 2. Busy check: an expert IN_PROGRESS right now cannot take bookings.
    const busyCount = await (session
      ? Consultation.countDocuments(
          buildExpertOccupiedFilter(expertId, consultationId),
        ).session(session)
      : Consultation.countDocuments(
          buildExpertOccupiedFilter(expertId, consultationId),
        ));

    if (busyCount > 0) {
      throw conflictError(
        "You are currently in a session. Close it before confirming another request.",
      );
    }

    return consultation;
  });

  // 3. Tell the user: session confirmed, here is the room link (pay at door).
  sendBookingStatusMail({
    to: confirmed.userEmail,
    clientName: confirmed.userName,
    expertName: expert.fullName,
    status: "confirmed",
    roomUrl: roomUrlFor(confirmed.id),
    amountLabel: `₹${(amount / 100).toFixed(0)}`,
  });

  // Live ping: the client's waiting screen flips to its Pay step the moment
  // this lands.
  publishToConsultation(confirmed.id, {
    event: "consultation.confirmed",
    consultationId: confirmed.id,
    consultation: { _id: confirmed.id, status: "CONFIRMED" },
  }).catch(() => {});

  return confirmed;
}

export async function declineConsultation({ expertId, consultationId, reason }) {
  if (!expertId) throw authenticationError("Authentication required.");

  const expert = await User.findById(expertId).select("fullName");

  const consultation = await Consultation.findOneAndUpdate(
    { _id: consultationId, expert: expertId, status: "PENDING" },
    {
      $set: {
        status: "CANCELLED",
        cancelledBy: "expert",
        cancelReason: reason?.trim() || "Declined by expert.",
      },
    },
    { new: true },
  );

  if (!consultation) throw notFoundError("No pending consultation request found.");

  // The user learns about the rejection by email.
  sendBookingStatusMail({
    to: consultation.userEmail,
    clientName: consultation.userName,
    expertName: expert?.fullName,
    status: "cancelled",
    reason: consultation.cancelReason,
  });

  publishToConsultation(consultation.id, {
    event: "consultation.cancelled",
    consultationId: consultation.id,
    consultation: { _id: consultation.id, status: "CANCELLED" },
  }).catch(() => {});

  return consultation;
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

const USER_CANCELLABLE = ["PENDING", "CONFIRMED"];
const EXPERT_CANCELLABLE = ["PENDING", "CONFIRMED", "IN_PROGRESS"];

export async function cancelConsultation({ userId, role, roles, consultationId, reason }) {
  if (!userId) throw authenticationError("Authentication required.");

  // Resolve the caller's actual side on THIS consultation first — the
  // primary role alone lies for dual accounts (an expert rating a booked
  // expert as a client, etc.). The side decides the cancellable states.
  let side = null;
  for (const candidate of sideCandidatesOf({ role, roles })) {
    const exists = await Consultation.exists(
      participantFilter(userId, candidate, { _id: consultationId }),
    );
    if (exists) {
      side = candidate;
      break;
    }
  }

  const cancellable = side === "expert" ? EXPERT_CANCELLABLE : side === "user" ? USER_CANCELLABLE : [];

  const consultation = await Consultation.findOneAndUpdate(
    {
      _id: consultationId,
      ...participantFilter(userId, side || role),
      status: { $in: cancellable },
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledBy: side || role,
        cancelReason: reason?.trim() || "Cancelled.",
      },
    },
    { new: true },
  );

  if (!consultation) {
    throw conflictError("This consultation can no longer be cancelled.");
  }

  publishToConsultation(consultation.id, {
    event: "consultation.cancelled",
    consultationId: consultation.id,
    consultation: { _id: consultation.id, status: "CANCELLED" },
  }).catch(() => {});

  return consultation;
}

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

/**
 * The participating user rates a completed consultation — once, enforced
 * atomically. The expert's aggregate rating is then recalculated from the
 * rating records themselves.
 */
export async function rateConsultation({ userId, consultationId, score, review }) {
  if (!userId) throw authenticationError("Authentication required.");

  const rating = Number(score);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw validationError("Rating must be a whole number between 1 and 5.");
  }
  const cleanReview = typeof review === "string" ? review.trim().slice(0, 2000) : "";

  const updated = await Consultation.findOneAndUpdate(
    {
      _id: consultationId,
      user: userId,
      status: "COMPLETED",
      // The partial unique index is the hard guarantee; this condition keeps
      // the API message friendly.
      "rating.score": { $exists: false },
    },
    {
      $set: {
        rating: {
          score: rating,
          review: cleanReview,
          ratedBy: userId,
          ratedAt: new Date(),
        },
      },
    },
    { new: true },
  );

  if (!updated) {
    const consultation = await Consultation.findOne({
      _id: consultationId,
      user: userId,
    }).lean();

    if (!consultation) throw notFoundError("Consultation not found.");
    if (consultation.status !== "COMPLETED") {
      throw validationError("Only completed consultations can be rated.");
    }
    if (consultation.rating?.score) {
      throw conflictError("You have already rated this consultation.");
    }
    throw notFoundError("Consultation not found.");
  }

  await refreshExpertRating(updated.expert);

  return updated;
}

/** Recomputes the expert's rating/count from the consultation records. */
export async function refreshExpertRating(expertId) {
  const expertOid = /^[0-9a-fA-F]{24}$/.test(String(expertId))
    ? new mongoose.Types.ObjectId(String(expertId))
    : expertId;

  const [stats] = await Consultation.aggregate([
    {
      $match: {
        expert: expertOid,
        "rating.score": { $type: "number" },
      },
    },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating.score" },
        count: { $sum: 1 },
      },
    },
  ]);

  await User.updateOne(
    { _id: expertId },
    {
      $set: {
        "expert.rating": stats ? Math.round(stats.average * 10) / 10 : 0,
        "expert.ratingCount": stats ? stats.count : 0,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Video session (Amazon Chime SDK)
// ---------------------------------------------------------------------------

/**
 * One-to-one video session over a consultation, carried by the Amazon Chime
 * SDK. The room exists as soon as the expert confirms (CONFIRMED). The user
 * receives the link by email and must complete the payment BEFORE entering;
 * the expert joins free. The session starts (IN_PROGRESS) when the paid user
 * joins — that is also when the expert becomes busy.
 *
 * The backend is the only AWS-aware component: `getSessionConfig` hands the
 * browser SDK the Chime meeting/attendee credentials (created lazily and
 * persisted by chime.service). Media never touches this server.
 *
 * Exactly two participants can access a room: the consultation's own user
 * and expert, resolved from the authenticated identity on every request.
 */

/**
 * Loads the consultation for a participant and returns their side.
 * Throws unless the caller is the assigned user or the assigned expert —
 * the ids always come from the token, never from the request.
 */
export async function authorizeParticipant({ consultationId, userId, role, roles }) {
  if (!userId) throw authenticationError("Authentication required.");

  // Strict: the caller must actually hold the user or expert capability —
  // primary role or the roles list. Other roles (author alone) never grant
  // session access on their own.
  const held = [
    ...(Array.isArray(roles) ? roles : []),
    ...(role ? [role] : []),
  ];
  const sides = [];
  if (held.includes("expert")) sides.push("expert");
  if (held.includes("user")) sides.push("user");

  if (sides.length === 0) {
    throw forbiddenError("Only the consultation's user and expert can access its session.");
  }

  for (const side of sides) {
    const consultation = await Consultation.findOne({
      _id: consultationId,
      ...(side === "expert" ? { expert: userId } : { user: userId }),
    });

    if (consultation) return { consultation, side };
  }

  throw notFoundError("Consultation not found.");
}

function sessionView(consultation, side) {
  const s = consultation.session || {};
  return {
    consultationId: consultation.id,
    status: consultation.status,
    side,
    paid: Boolean(consultation.payment?.paid) || consultation.amount === 0,
    // Participant display names (only present when the doc was populated).
    userName: consultation.user?.fullName || "",
    expertName: consultation.expert?.fullName || "",
    session: {
      startedAt: s.startedAt || null,
      endedAt: s.endedAt || null,
      durationSeconds: s.durationSeconds || 0,
    },
  };
}

async function isPaid(consultation) {
  return paymentService.hasPaidPayment(consultation);
}

/**
 * Room state + Chime credentials. A confirmed-but-unpaid user is NOT
 * rejected — they get `paymentRequired: true` plus the amount, and only
 * AFTER paying do they receive the `chime` meeting/attendee tokens (the
 * join token is the key to the room, so it is never given to an unpaid
 * caller). The expert always receives them immediately.
 */
export async function getSessionConfig({ consultationId, userId, role }) {
  const { consultation, side } = await authorizeParticipant({
    consultationId,
    userId,
    role,
  });

  // Pull in the participant display names for the room UI. Optional chaining
  // keeps plain (unpopulated / test) docs working untouched.
  await consultation.populate?.([
    { path: "user", select: "fullName" },
    { path: "expert", select: "fullName" },
  ]);

  if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(consultation.status)) {
    throw forbiddenError(
      `A ${consultation.status.toLowerCase()} consultation cannot be joined.`,
    );
  }
  if (consultation.status === "PENDING") {
    throw forbiddenError(
      "This consultation is not confirmed yet. Join once the expert has confirmed it.",
    );
  }

  const paymentRequired = side === "user" && !(await isPaid(consultation));

  // Unpaid users get the payment details only — no room keys.
  const chime = paymentRequired
    ? null
    : await ensureChimeSession(consultation, side, userId);

  return {
    ...sessionView(consultation, side),
    paymentRequired,
    ...(paymentRequired
      ? {
          amount: consultation.amount,
          currency: consultation.currency || "INR",
        }
      : {}),
    ...(chime ? { chime } : {}),
  };
}

/**
 * Enter the room.
 *  - The user must have paid (or the consultation is free) — the session
 *    then starts: CONFIRMED → IN_PROGRESS with startedAt set.
 *  - The expert joins free; a confirmed booking already waits for them.
 */
export async function joinSession({ consultationId, userId, role }) {
  const { consultation, side } = await authorizeParticipant({
    consultationId,
    userId,
    role,
  });

  if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(consultation.status)) {
    throw forbiddenError(
      `A ${consultation.status.toLowerCase()} consultation cannot be joined.`,
    );
  }
  if (consultation.status === "PENDING") {
    throw forbiddenError("The expert has not confirmed this consultation yet.");
  }

  // The pay wall: only the user pays, only before entering.
  if (side === "user" && !(await isPaid(consultation))) {
    throw conflictError("Payment required before joining the session.");
  }

  const now = new Date();
  const joinedAtField = side === "user" ? "userJoinedAt" : "expertJoinedAt";
  const heartbeatField = side === "user" ? "userHeartbeatAt" : "expertHeartbeatAt";

  // The user's first join starts the session; the expert's join never does.
  const updated = await Consultation.findOneAndUpdate(
    {
      _id: consultation._id,
      status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
    },
    {
      $set: {
        ...(side === "user"
          ? {
              status: "IN_PROGRESS",
              "session.startedAt": consultation.session?.startedAt || now,
            }
          : {}),
        [`session.${joinedAtField}`]: now,
        [`session.${heartbeatField}`]: now,
      },
    },
    { new: true },
  );

  if (!updated) throw conflictError("This session can no longer be joined.");

  // Live ping: the expert's waiting room flips to "client has joined" and
  // the client's screens sync — the socket is a signal, the API is truth.
  if (updated.status !== consultation.status) {
    publishToConsultation(updated.id, {
      event: "consultation.updated",
      consultationId: updated.id,
      consultation: { _id: updated.id, status: updated.status },
    }).catch(() => {});
  }

  return sessionView(updated, side);
}

/** Liveness ping; also drives the stale-session sweep. Both sides may
 *  heartbeat before the session goes IN_PROGRESS (the expert usually waits
 *  in the room first) — only closed sessions refuse. */
export async function heartbeat({ consultationId, userId, role }) {
  const { consultation, side } = await authorizeParticipant({
    consultationId,
    userId,
    role,
  });

  if (!["CONFIRMED", "IN_PROGRESS"].includes(consultation.status)) {
    throw conflictError("No live session to keep alive.");
  }

  const now = new Date();
  const field = side === "user" ? "userHeartbeatAt" : "expertHeartbeatAt";

  const updated = await Consultation.findOneAndUpdate(
    { _id: consultation._id, status: { $in: ["CONFIRMED", "IN_PROGRESS"] } },
    { $set: { [`session.${field}`]: now } },
    { new: true },
  );

  if (!updated) throw conflictError("The session has already ended.");

  // Opportunistic sweep: if both sides went quiet, close it here.
  const staleMs = config.consult.sessionStaleMinutes * 60 * 1000;
  if (isSessionStale(updated.session, staleMs, now.getTime())) {
    await forceComplete(updated);
  }

  return sessionView(updated, side);
}

/**
 * Close the meeting. Either side can end it — the expert closing is the
 * normal path, after which the user is prompted to share their experience.
 */
export async function endSession({ consultationId, userId, role, reason }) {
  const { consultation, side } = await authorizeParticipant({
    consultationId,
    userId,
    role,
  });

  if (consultation.status === "COMPLETED") {
    return sessionView(consultation, side); // idempotent
  }
  if (consultation.status !== "IN_PROGRESS" && consultation.status !== "CONFIRMED") {
    throw conflictError(`A ${consultation.status.toLowerCase()} session cannot be ended.`);
  }

  const endedAt = new Date();
  const updated = await Consultation.findOneAndUpdate(
    { _id: consultation._id, status: { $in: ["CONFIRMED", "IN_PROGRESS"] } },
    {
      $set: {
        status: "COMPLETED",
        "session.startedAt": consultation.session?.startedAt || endedAt,
        "session.endedAt": endedAt,
        "session.durationSeconds": sessionDurationSeconds(
          consultation.session?.startedAt || endedAt,
          endedAt,
        ),
      },
    },
    { new: true },
  );

  if (!updated) throw conflictError("The session has already been closed.");

  // Tear down the AWS meeting — its attendees are removed with it, and the
  // peer's browser SDK sees the session stop immediately.
  await deleteChimeMeeting(updated);

  // Only a session that actually ran counts towards the expert's tally.
  if (updated.session?.durationSeconds > 0) {
    await User.updateOne({ _id: consultation.expert }, { $inc: { "expert.sessions": 1 } });
  }

  // The user is invited to share their experience.
  sendBookingStatusMail({
    to: consultation.userEmail,
    clientName: consultation.userName,
    expertName: (await User.findById(consultation.expert).select("fullName"))?.fullName,
    status: "completed",
    bookingsUrl: (config.frontend.client || "").replace(/\/$/, "") + "/bookings",
  });

  // Live ping: THE rating-flow driver — the mobile app flips its user to the
  // in-app rating screen the moment this frame lands (no web rating page).
  publishToConsultation(updated.id, {
    event: "consultation.completed",
    consultationId: updated.id,
    consultation: { _id: updated.id, status: "COMPLETED" },
  }).catch(() => {});

  return sessionView(updated, side);
}

/** Force-completes an abandoned session (used by heartbeat + sweeps). */
async function forceComplete(consultation) {
  const endedAt = lastActivityAt(consultation.session);
  const result = await Consultation.updateOne(
    { _id: consultation._id, status: "IN_PROGRESS" },
    {
      $set: {
        status: "COMPLETED",
        "session.endedAt": endedAt,
        "session.durationSeconds": sessionDurationSeconds(
          consultation.session?.startedAt,
          endedAt,
        ),
      },
    },
  );

  if (result.modifiedCount > 0) {
    await deleteChimeMeeting(consultation);
    if (sessionDurationSeconds(consultation.session?.startedAt, endedAt) > 0) {
      await User.updateOne({ _id: consultation.expert }, { $inc: { "expert.sessions": 1 } });
    }
    logger.info("Stale consultation session force-completed", {
      consultationId: consultation.id,
    });
    publishToConsultation(consultation.id, {
      event: "consultation.completed",
      consultationId: consultation.id,
      consultation: { _id: consultation.id, status: "COMPLETED" },
    }).catch(() => {});
  }
}

export { PAYABLE_STATUSES };
