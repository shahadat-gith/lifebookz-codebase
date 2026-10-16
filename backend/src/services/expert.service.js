import User from "../models/User.js";
import Consultation from "../models/Consultation.js";

import { verifyPassword, flattenUser } from "../utils/helpers.js";
import {
  authenticationError,
  conflictError,
  notFoundError,
  validationError,
} from "../utils/errors.js";
import { sendApplicationSubmitted } from "../utils/admin.utils.js";
import { logger } from "./logger.service.js";
import { deleteFile } from "./upload.service.js";
import {
  parseCategories,
  parseLanguages,
  validateCategories,
} from "../utils/expert.utils.js";
import { accountToken } from "./user.service.js";

const PUBLIC_EXPERT_SELECT =
  "fullName avatar coverImage createdAt expert";

async function findExpertById(userId) {
  if (!userId) {
    throw authenticationError("Authentication required.");
  }

  const expert = await User.findById(userId);

  if (!expert) {
    throw notFoundError("Expert not found.");
  }

  return expert;
}

/**
 * Required expert-application fields. Upgrading to `expert` is only
 * possible once all of these are filled in.
 */
const EXPERT_REQUIRED_FIELDS = ["expertise", "qualification", "bio", "phone"];

/**
 * Applies expert details onto the expert block — created on first edit —
 * and returns which required fields are still missing.
 */
function applyExpertDetails(expertDoc, body) {
  const { expertise, qualification, categories, bio, phone, languages, experience, price } = body;

  // READ the subdoc back after creating it: assigning through an unset
  // subdoc path keeps the callback-side object detached from the document.
  if (!expertDoc.expert) {
    expertDoc.expert = {};
  }
  const profile = expertDoc.expert;

  if (expertise?.trim()) profile.expertise = expertise.trim();
  if (qualification?.trim()) profile.qualification = qualification.trim();
  if (bio?.trim()) profile.bio = bio.trim();
  if (phone?.trim()) profile.phone = phone.trim();

  if (categories !== undefined) {
    profile.categories = validateCategories(parseCategories(categories));
  }

  if (languages !== undefined) {
    profile.languages = parseLanguages(languages);
  }

  if (experience !== undefined) {
    profile.experience = Math.max(0, Number(experience) || 0);
  }

  if (price !== undefined) profile.price = Math.max(0, Number(price) || 0);

  return EXPERT_REQUIRED_FIELDS.filter((field) => !(profile[field] || "").trim());
}

/**
 * Roll back everything a failed upgrade may have written.
 * Cleanup failures are logged, never thrown, so the original error is what
 * reaches the caller.
 */
async function discardFailedRegistration(expert) {
  const expertId = expert?._id?.toString() || null;

  try {
    await User.deleteOne({ _id: expert._id });
  } catch (error) {
    logger.error("Failed to remove expert after failed registration", {
      expertId,
      reason: error.message,
    });
  }

  if (expert?.avatar?.key) {
    try {
      await deleteFile(expert.avatar.key);
    } catch (error) {
      logger.error("Failed to remove expert avatar after failed registration", {
        expertId,
        reason: error.message,
      });
    }
  }
}

/**
 * Upgrade an existing account to `expert`. Any signed-in account (role
 * `user` or `author`) can apply; the account becomes `expert` only once
 * the required consultation fields are filled in — application pending.
 */
export async function upgradeToExpert({ userId, body, avatar }) {
  const expert = await User.findById(userId);

  if (!expert) {
    throw notFoundError("Expert not found.");
  }

  // A dual account (author + expert) can hold BOTH roles — upgrading only
  // ever adds the expert capability.
  if (expert.roles?.includes("expert")) {
    throw conflictError("This account is already an expert.");
  }

  const missing = applyExpertDetails(expert, body);

  if (missing.length) {
    throw validationError(
      `Please fill all required fields: ${missing.join(", ")}.`,
    );
  }

  // Optional pre-uploaded avatar, applied from the dashboard later too.
  if (avatar !== undefined) expert.avatar = avatar;

  // The expert capability is ADDED — an author who upgrades stays a
  // published-author too, so one account can use all three portals. The
  // validate hook syncs isExpert from the array.
  expert.roles = expert.roles?.length
    ? Array.from(new Set([...expert.roles, "expert"]))
    : ["user", "expert"];

  try {
    await expert.save();
  } catch (error) {
    await discardFailedRegistration(expert);
    throw error;
  }

  // Fire-and-forget: tell the account the upgrade request reached the
  // admin and what approval unlocks (the approved/rejected mails follow
  // from the admin's decision).
  sendApplicationSubmitted(expert.email, expert.fullName, "expert").catch(
    () => {},
  );

  return { expert, token: accountToken(expert) };
}

/**
 * One account serves every portal, so the expert portal accepts any
 * existing account — including ones still applying (the dashboard shows
 * where they stand and what is missing).
 */
export async function loginExpert({ email, password, ip }) {
  let user = await User.findOne({ email }).select("+auth.passwordHash");

  if (!user) {
    await logger.warn("Expert portal login failed — no account for this email", {
      email,
      ip,
    });

    throw authenticationError("No account found with this email.", {
      email: "No account found with this email.",
    });
  }

  const isValid = await verifyPassword(password, user.auth.passwordHash);

  if (!isValid) {
    await logger.warn("Expert portal login failed — incorrect password", {
      userId: user.id,
      email,
      ip,
    });

    const message = "Incorrect password. Try again, or reset it.";

    throw authenticationError(message, { password: message });
  }

  return { expert: user, token: accountToken(user) };
}

export async function getMyExpertProfile(userId) {
  const expert = await User.findById(userId).lean();

  if (!expert) {
    throw notFoundError("Expert not found.");
  }

  return flattenUser(expert);
}

/**
 * Toggles the expert's availability for new consultation requests. When
 * unavailable the expert is left out of matching results entirely; live
 * sessions are unaffected.
 */
export async function setAvailability({ userId, isAvailable }) {
  if (!userId) {
    throw authenticationError("Authentication required.");
  }
  if (typeof isAvailable !== "boolean") {
    throw validationError("`isAvailable` must be true or false.");
  }

  const expert = await User.findByIdAndUpdate(
    userId,
    { $set: { "expert.isAvailable": isAvailable } },
    { new: true, runValidators: true },
  ).select("fullName expert.isAvailable");

  if (!expert) {
    throw notFoundError("Expert not found.");
  }

  return expert;
}

export async function updateExpert({ userId, body, avatar, coverImage }) {
  const expert = await findExpertById(userId);

  const { fullName } = body;

  if (fullName !== undefined && fullName.trim()) {
    expert.fullName = fullName.trim();
  }

  applyExpertDetails(expert, body);

  // Images arrive as presigned { url, key } uploads from the dashboard.
  const replacedKeys = [];

  if (avatar !== undefined) {
    replacedKeys.push(["avatar", expert.avatar?.key]);
    expert.avatar = avatar;
  }

  if (coverImage !== undefined) {
    replacedKeys.push(["coverImage", expert.coverImage?.key]);
    expert.coverImage = coverImage;
  }

  await expert.save();

  // Replaced images are only removed once the new ones are committed.
  await Promise.all(
    replacedKeys
      .filter(([, key]) => key)
      .map(([field, key]) =>
        deleteFile(key).catch((error) =>
          logger.warn("Failed to delete replaced expert image", {
            expertId: expert.id,
            field,
            key,
            reason: error.message,
          }),
        ),
      ),
  );

  return expert;
}

/**
 * The expert's consultations, newest first. Lifecycle actions (accept,
 * decline, end session) live in the consult services — this is a read.
 */
export async function listBookingsForExpert({ expertId }) {
  if (!expertId) {
    throw authenticationError("Authentication required.");
  }

  return Consultation.find({ expert: expertId })
    .populate("user", "fullName avatar")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
}

export async function getPublicExpert(expertId) {
  const expert = await User.findOne({
    _id: expertId,
    roles: "expert",
    status: "active",
  })
    .select(PUBLIC_EXPERT_SELECT)
    .lean();

  if (!expert) {
    throw notFoundError("Expert not found.");
  }

  return flattenUser(expert);
}
