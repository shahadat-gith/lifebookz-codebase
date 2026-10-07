import crypto from "node:crypto";
import mongoose from "mongoose";

import Expert from "../models/Expert.js";
import Consultation from "../models/Consultation.js";
import User from "../models/User.js";
import Author from "../models/Author.js";
import HandoffTicket from "../models/HandoffTicket.js";
import { generateToken } from "../utils/helpers.js";
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
const EXPERT_SELECT =
  "fullName username expertise qualification categories bio languages experience price avatar rating ratingCount sessions";

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

const HANDOFF_ACCOUNT_MODELS = { user: User, author: Author, expert: Expert };

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
  if (!HANDOFF_ACCOUNT_MODELS[role]) {
    throw forbiddenError("This account type cannot open a consultation room.");
  }

  const idClaim = role === "user" ? "userId" : `${role}Id`;
  const accountId = decoded[idClaim];
  if (!accountId) throw authenticationError("Invalid token.");

  // The account must still exist and be active — a stale token cannot mint
  // a ticket.
  const account = await HANDOFF_ACCOUNT_MODELS[role].findById(accountId).select("_id status");
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

  const claim = ticket.role === "user" ? "userId" : `${ticket.role}Id`;

  return {
    token: generateToken({ role: ticket.role, [claim]: ticket.accountId }),
    role: ticket.role,
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
    await Expert.updateOne({ _id: doc.expert }, { $inc: { sessions: 1 } });
    abandoned += 1;
  }

  if (expiredRequests.modifiedCount || abandoned) {
    logger.info("Consultation sweep", {
      expiredRequests: expiredRequests.modifiedCount,
      abandoned,
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
    status: "active",
    "verification.status": "approved",
    isAvailable: { $ne: false },
    _id: { $nin: busyIds },
  };

  if (cleanCategory) query.categories = cleanCategory;

  const experts = await Expert.find(query).select(EXPERT_SELECT).lean();

  experts.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return {
    experts: experts.slice(0, safeLimit),
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

  const expert = await Expert.findOne({
    _id: expertId,
    status: "active",
    "verification.status": "approved",
  }).select("fullName email price");

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
    amount: Math.round((expert.price || 0) * 100),
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

  return consultation;
}

// ---------------------------------------------------------------------------
// Reads (strictly participant-scoped)
// ---------------------------------------------------------------------------

function participantFilter(id, role, extra = {}) {
  return role === "expert" ? { expert: id, ...extra } : { user: id, ...extra };
}

export async function listMine({ userId, role = "user", status }) {
  if (!userId) throw authenticationError("Authentication required.");

  const extra = {};
  if (status && CONSULTATION_STATUSES.includes(status)) extra.status = status;

  return Consultation.find(participantFilter(userId, role, extra))
    .populate("expert", "fullName username expertise avatar rating ratingCount price")
    .populate("user", "fullName username avatar")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
}

export async function getForParticipant({ id, role, userId }) {
  if (!userId) throw authenticationError("Authentication required.");

  await expireStaleConsultations();

  const consultation = await Consultation.findOne(
    participantFilter(userId, role, { _id: id }),
  )
    .populate("expert", "fullName username expertise avatar rating ratingCount price")
    .populate("user", "fullName username avatar")
    .lean();

  if (!consultation) throw notFoundError("Consultation not found.");
  return consultation;
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

  const expert = await Expert.findById(expertId).select("fullName price");
  if (!expert) throw notFoundError("Expert not found.");

  const amount = Math.round((expert.price || 0) * 100);

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

  return confirmed;
}

export async function declineConsultation({ expertId, consultationId, reason }) {
  if (!expertId) throw authenticationError("Authentication required.");

  const expert = await Expert.findById(expertId).select("fullName");

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

  return consultation;
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

const USER_CANCELLABLE = ["PENDING", "CONFIRMED"];
const EXPERT_CANCELLABLE = ["PENDING", "CONFIRMED", "IN_PROGRESS"];

export async function cancelConsultation({ userId, role, consultationId, reason }) {
  if (!userId) throw authenticationError("Authentication required.");

  const cancellable = role === "expert" ? EXPERT_CANCELLABLE : USER_CANCELLABLE;

  const consultation = await Consultation.findOneAndUpdate(
    {
      _id: consultationId,
      ...participantFilter(userId, role),
      status: { $in: cancellable },
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledBy: role,
        cancelReason: reason?.trim() || "Cancelled.",
      },
    },
    { new: true },
  );

  if (!consultation) {
    throw conflictError("This consultation can no longer be cancelled.");
  }

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

  await Expert.updateOne(
    { _id: expertId },
    {
      $set: {
        rating: stats ? Math.round(stats.average * 10) / 10 : 0,
        ratingCount: stats ? stats.count : 0,
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
export async function authorizeParticipant({ consultationId, userId, role }) {
  if (!userId) throw authenticationError("Authentication required.");
  if (role !== "user" && role !== "expert") {
    throw forbiddenError("Only the consultation's user and expert can access its session.");
  }

  const consultation = await Consultation.findOne({
    _id: consultationId,
    ...(role === "expert" ? { expert: userId } : { user: userId }),
  });

  if (!consultation) throw notFoundError("Consultation not found.");
  return { consultation, side: role };
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
    await Expert.updateOne({ _id: consultation.expert }, { $inc: { sessions: 1 } });
  }

  // The user is invited to share their experience.
  sendBookingStatusMail({
    to: consultation.userEmail,
    clientName: consultation.userName,
    expertName: (await Expert.findById(consultation.expert).select("fullName"))?.fullName,
    status: "completed",
    bookingsUrl: (config.frontend.client || "").replace(/\/$/, "") + "/bookings",
  });

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
      await Expert.updateOne({ _id: consultation.expert }, { $inc: { sessions: 1 } });
    }
    logger.info("Stale consultation session force-completed", {
      consultationId: consultation.id,
    });
  }
}

export { PAYABLE_STATUSES };
