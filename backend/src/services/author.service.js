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
import { sendApplicationSubmitted } from "../utils/admin.utils.js";
import { accountToken } from "./user.service.js";

const PUBLIC_AUTHOR_SELECT =
  // `roles` is included so a lean projection still passes the author check.
  "fullName avatar coverImage createdAt role roles author";

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
 * the author portal accepts any existing account. A plain `user` who signs
 * in here is upgraded to `author` on the spot (application starts pending)
 * — the dashboard is where they complete their profile and publish.
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

  // Implicit upgrade: any account coming through the author portal gains
  // the author role (application pending) — including experts and authors
  // of other kinds. Upgrades ADD to `roles` and never remove what the
  // account already holds.
  if (!user.roles?.includes("author")) {
    const previousRole = user.role;
    user.role = "author";
    user.roles = [...(user.roles?.length ? user.roles : [user.role]), "author"];
    user.author = user.author || {};
    await user.save();
    user = await User.findById(user.id);

    // Fire-and-forget: the freshly granted author role needs admin approval
    // — tell the account the request is pending and what it unlocks.
    sendApplicationSubmitted(user.email, user.fullName, "author").catch(
      () => {},
    );
  }

  return { author: user, token: accountToken(user, user.role) };
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

  // Profile is considered complete once the publishing-critical fields are
  // all filled in. Keeps existing true values sticky (admins/bans aside).
  const profileDone = Boolean(
    (profile.profession || "").trim() &&
      (profile.bio || "").trim() &&
      (profile.phone || "").trim() &&
      profile.dob &&
      profile.gender,
  );
  if (profileDone || profile.isProfileCompleted) {
    profile.isProfileCompleted = profileDone;
  }

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

  if (!author || !author.roles?.includes("author")) {

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
 * chapters, stories, and total likes received.
 */
export async function getMyAuthorStats({ authorId }) {
  if (!authorId) {
    throw authenticationError("Authentication required.");
  }

  // Aggregations do not cast strings for us — an unmatched ObjectId would
  // quietly report zero chapters and stories.
  const owner = new mongoose.Types.ObjectId(String(authorId));

  const books = await Story.aggregate([
      // Everything the author owns: the profile page counts drafts too.
      { $match: { author: owner } },
      {
        $project: {
          likes: { $ifNull: ["$stats.likes", 0] },
          chapters: { $size: { $ifNull: ["$chapters", []] } },
          stories: {
            $sum: {
              $map: {
                input: { $ifNull: ["$chapters", []] },
                as: "ch",
                in: { $size: { $ifNull: ["$$ch.stories", []] } },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          likes: { $sum: "$likes" },
          chapters: { $sum: "$chapters" },
          stories: { $sum: "$stories" },
        },
      },
  ]);

  return {
    chapters: books[0]?.chapters || 0,
    stories: books[0]?.stories || 0,
    likes: books[0]?.likes || 0,
  };
}

export async function listApprovedAuthors() {
  const listed = await User.find({
    roles: "author",
    "author.verification.status": "approved",
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
