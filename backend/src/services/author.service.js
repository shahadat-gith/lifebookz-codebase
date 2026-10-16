import mongoose from "mongoose";

import User from "../models/User.js";
import Story from "../models/Story.js";

import { verifyPassword, flattenUser } from "../utils/helpers.js";
import {
  authenticationError,
  notFoundError,
  validationError,
} from "../utils/errors.js";
import { logger } from "./logger.service.js";
import { deleteFile } from "./upload.service.js";
import { accountToken } from "./user.service.js";

const PUBLIC_AUTHOR_SELECT =
  // `roles` is included so a lean projection still passes the author check.
  "fullName avatar coverImage createdAt roles isAuthor author";

/**
 * FormData sends nested objects as JSON strings — decode defensively.
 */
function parseJsonField(value, { strict = false } = {}) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    if (strict) throw validationError("Invalid social links.");
    return undefined;
  }
}

async function findAuthorById(userId) {
  if (!userId) {
    throw authenticationError("Authentication required.");
  }

  const author = await User.findById(userId);

  if (!author) {
    throw notFoundError("Author not found.");
  }

  return author;
}

/**
 * One account serves every portal (sign-up lives in the client portal), so
 * the author portal accepts any existing account and signs it in AS IS —
 * logging in NEVER grants the author role. Upgrading happens deliberately
 * (the publish-time upgrade form calls `upgradeToAuthor`), so a reader who
 * only came to look around stays a reader.
 */
export async function loginAuthor({ email, password, ip }) {
  let user = await User.findOne({ email }).select("+auth.passwordHash");

  if (!user) {
    await logger.warn("Author portal login failed — no account for this email", {
      email,
      ip,
    });

    throw authenticationError("No account found with this email.", {
      email: "No account found with this email.",
    });
  }

  const isValid = await verifyPassword(password, user.auth.passwordHash);

  if (!isValid) {
    await logger.warn("Author portal login failed — incorrect password", {
      userId: user.id,
      email,
      ip,
    });

    const message = "Incorrect password. Try again, or reset it.";

    throw authenticationError(message, { password: message });
  }

  // No side-effect upgrade here — the account keeps its current roles.
  return { author: user, token: accountToken(user) };
}

const UPGRADE_REQUIRED_FIELDS = [
  { key: "profession", label: "profession" },
  { key: "bio", label: "bio" },
  { key: "phone", label: "phone" },
  { key: "dob", label: "date of birth" },
  { key: "gender", label: "gender" },
];

/**
 * Deliberate author upgrade: grants the author role to any signed-in
 * account once the publishing-critical profile fields are filled in. No
 * admin review — completing the form IS the upgrade. The publish gate reads
 * the root-level `isAuthor` flag, which the pre-validate hook keeps in
 * lockstep with `roles`.
 */
export async function upgradeToAuthor({ userId, body }) {
  const user = await findAuthorById(userId);

  const alreadyAuthor = Boolean(user.roles?.includes("author"));

  // Fields are applied on EVERY submission — including accounts that
  // already hold the author role but never finished their profile.
  const missing = UPGRADE_REQUIRED_FIELDS.filter(
    ({ key }) => !String(body[key] || "").trim() && !(key === "dob" && user.author?.dob),
  ).map(({ label }) => label);

  if (missing.length > 0) {
    throw validationError(`Please fill in: ${missing.join(", ")}.`);
  }

  if (!user.author) user.author = {};
  const profile = user.author;

  profile.profession = String(body.profession).trim();
  profile.bio = String(body.bio).trim();
  profile.phone = String(body.phone).trim();
  profile.dob = profile.dob || new Date(body.dob);
  profile.gender = body.gender;
  if (body.address) profile.address = { ...(profile.address || {}), ...body.address };
  if (body.socialLinks) profile.socialLinks = { ...(profile.socialLinks || {}), ...body.socialLinks };

  if (!alreadyAuthor) {
    // Upgrades ADD to `roles` and never remove what the account already
    // holds; the validate hook syncs isAuthor from the array.
    user.roles = [...(user.roles?.length ? user.roles : ["user"]), "author"];
  }

  await user.save();

  return { user, alreadyAuthor };
}

export async function getMyAuthorProfile(userId) {
  const author = await User.findById(userId).lean();

  if (!author) {
    throw notFoundError("Author not found.");
  }

  return flattenUser(author);
}

export async function updateAuthor({
  userId,
  body,
  avatar,
  coverImage,
}) {
  const author = await findAuthorById(userId);

  let { fullName, profession, bio, phone, dob, gender, address, socialLinks } =
    body;

  // Parse JSON strings when sent via FormData
  socialLinks = parseJsonField(socialLinks);
  address = parseJsonField(address);

  // The profile lives in the author block — created on first edit. Reading
  // the subdoc back keeps the object attached to the document.
  if (!author.author) {
    author.author = {};
  }
  const profile = author.author;

  if (fullName !== undefined) author.fullName = fullName;
  if (profession !== undefined) profile.profession = profession;
  if (bio !== undefined) profile.bio = bio;
  if (phone !== undefined) profile.phone = phone;
  if (dob !== undefined) profile.dob = new Date(dob);
  if (gender !== undefined) profile.gender = gender;

  if (address) {
    profile.address = { ...(profile.address || {}), ...address };
  }

  if (socialLinks) {
    profile.socialLinks = { ...(profile.socialLinks || {}), ...socialLinks };
  }

  // Images arrive as presigned { url, key } uploads from the dashboard.
  // New images replace the stored ones only after a successful save; the
  // superseded objects are cleaned up afterwards, best-effort.
  const replacedKeys = [];

  if (avatar !== undefined) {
    replacedKeys.push(["avatar", author.avatar?.key]);
    author.avatar = avatar;
  }

  if (coverImage !== undefined) {
    replacedKeys.push(["coverImage", author.coverImage?.key]);
    author.coverImage = coverImage;
  }

  // Upgraded-ness lives on the user's root `isAuthor` flag — profile edits
  // never grant or revoke the role themselves.

  await author.save();

  // Replaced images are only removed once the new ones are committed.
  await Promise.all(
    replacedKeys
      .filter(([, key]) => key && key !== "")
      .map(([, key]) => deleteFile(key).catch(() => {})),
  );

  return author;
}

/**
 * An author as any visitor sees them.
 */
export async function getPublicAuthor({ authorId, viewerId } = {}) {
  const author = await User.findById(authorId)
    .select(PUBLIC_AUTHOR_SELECT)
    .lean();

  if (!author || !author.isAuthor) {

    throw notFoundError("Author not found.");
  }

  const isSelf = Boolean(viewerId) && String(viewerId) === String(author._id);

  // The published count is derived here rather than read from the stored
  // counter, which only moves when a story is published or removed.
  const storyCount = await Story.countDocuments({
    author: author._id,
    status: "published",
    visibility: "public",
  });

  return {
    ...flattenUser(author),
    stats: { ...author.author?.stats, stories: storyCount },
    isSelf,
  };
}

export async function listMyStories({ authorId }) {
  if (!authorId) {
    throw authenticationError("Authentication required.");
  }

  return Story.find({ author: authorId }).sort({ updatedAt: -1 }).lean();
}

/** Same list, without the story documents' heavy rich-text content. */
export async function listMyStorySummaries({ authorId }) {
  if (!authorId) {
    throw authenticationError("Authentication required.");
  }

  return Story.find({ author: authorId })
    .select("-content")
    .sort({ updatedAt: -1 })
    .lean();
}

export async function getMyStory({ authorId, storyId }) {
  if (!authorId) {
    throw authenticationError("Authentication required.");
  }

  const story = await Story.findOne({ _id: storyId, author: authorId }).lean();

  if (!story) {
    throw notFoundError("Story not found.");
  }

  return story;
}

/**
 * Aggregated profile stats for the author's own profile page:
 * stories, the chapters their grouping selects, and total likes received.
 * One count query per number — all flat documents now.
 */
export async function getMyAuthorStats({ authorId }) {
  if (!authorId) {
    throw authenticationError("Authentication required.");
  }

  const owner = new mongoose.Types.ObjectId(String(authorId));

  const [stories, chapters, likes] = await Promise.all([
    Story.countDocuments({ author: owner }),
    Story.distinct("chapterName", {
      author: owner,
      chapterName: { $type: "string", $ne: "" },
    }).then((names) => names.length),
    Story.aggregate([
      { $match: { author: owner } },
      {
        $group: {
          _id: null,
          likes: { $sum: { $ifNull: ["$stats.likes", 0] } },
        },
      },
    ]),
  ]);

  return {
    stories,
    chapters,
    likes: likes[0]?.likes || 0,
  };
}

export async function listApprovedAuthors() {
  // No approval pipeline — every account holding the author role is listed.
  const listed = await User.find({
    roles: "author",
  })
    .select("fullName avatar bio createdAt author")
    .sort({ createdAt: -1 })
    .lean();

  const authorIds = listed.map((a) => a._id);
  const countMap = {};

  if (authorIds.length > 0) {
    const storyCounts = await Story.aggregate([
      { $match: { author: { $in: authorIds }, status: "published" } },
      { $group: { _id: "$author", count: { $sum: 1 } } },
    ]);

    storyCounts.forEach((row) => {
      countMap[row._id.toString()] = row.count;
    });
  }

  return listed.map((author) => ({
    ...flattenUser(author),
    storyCount: countMap[author._id.toString()] || 0,
  }));
}
