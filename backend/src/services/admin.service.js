import config from "../config/index.js";

import User from "../models/User.js";
import Story from "../models/Story.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";

import { generateToken, flattenUser } from "../utils/helpers.js";
import {
  authenticationError,
  notFoundError,
  serviceUnavailableError,
  validationError,
} from "../utils/errors.js";

import { sendApplicationApproved, sendApplicationRejected } from "../utils/admin.utils.js";

export function loginAdmin({ email, password }) {
  if (!config.admin.email || !config.admin.password || !config.admin.key) {
    throw serviceUnavailableError(
      "Admin access is not configured on this server.",
    );
  }

  // There is exactly one admin, from env, so naming the wrong half of the
  // pair tells an attacker nothing they could not already guess — and it is
  // the difference between a five-second retry and a support ticket.
  if (email !== config.admin.email) {
    const message = "Incorrect admin email.";

    throw authenticationError(message, { email: message });
  }

  if (password !== config.admin.password) {
    const message = "Incorrect admin password.";

    throw authenticationError(message, { password: message });
  }

  return generateToken({ role: "admin", key: config.admin.key });
}

/**
 * The single admin identity (there is exactly one, from env).
 */
export function getAdminIdentity() {
  return { email: config.admin.email, role: "admin" };
}

export async function getDashboardStats() {
  const [readers, authors, stories, experts, pendingAuthors, pendingExperts] =
    await Promise.all([
      User.countDocuments({ role: "user" }),
      User.countDocuments({ roles: "author" }),
      Story.countDocuments({ status: "published" }),
      User.countDocuments({ roles: "expert" }),
      User.countDocuments({ roles: "author", "author.verification.status": "pending" }),
      User.countDocuments({ roles: "expert", "expert.verification.status": "pending" }),
    ]);

  return {
    totalUsers: readers,
    totalAuthors: authors,
    totalStories: stories,
    totalExperts: experts,
    pendingAuthors,
    pendingExperts,
  };
}

// ---------------------------------------------------------------------------
// Author applications
// ---------------------------------------------------------------------------

export async function listPendingAuthors() {
  const authors = await User.find({
    roles: "author",
    "author.verification.status": "pending",
  })
    .sort({ createdAt: 1 })
    .lean();

  return authors.map(flattenUser);
}

export async function approveAuthor({ authorId }) {
  const author = await User.findOne({ _id: authorId, roles: "author" });

  if (!author) {
    throw notFoundError("Author not found.");
  }

  const authorProfile = author.author || (author.author = {});

  authorProfile.verification = authorProfile.verification || {};
  authorProfile.verification.status = "approved";
  author.author.verification.verifiedAt = new Date();
  author.author.verification.rejectionReason = "";

  await author.save();

  // Fire-and-forget: the response should not wait on SES.
  sendApplicationApproved(author.email, author.fullName, "author");

  return author;
}

export async function rejectAuthor({ authorId, reason }) {
  if (!reason?.trim()) {
    throw validationError("Rejection reason is required.");
  }

  const author = await User.findOne({ _id: authorId, roles: "author" });

  if (!author) {
    throw notFoundError("Author not found.");
  }

  const authorProfile = author.author || (author.author = {});

  authorProfile.verification = authorProfile.verification || {};
  authorProfile.verification.status = "rejected";
  author.author.verification.verifiedAt = new Date();
  author.author.verification.rejectionReason = reason.trim();

  await author.save();

  sendApplicationRejected(author.email, author.fullName, reason.trim(), "author");

  return author;
}

export async function listApprovedAuthors() {
  const authors = await User.find({
    roles: "author",
    "author.verification.status": "approved",
  })
    .sort({ createdAt: -1 })
    .lean();

  const authorIds = authors.map((a) => a._id);
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

  return authors.map((author) => ({
    ...flattenUser(author),
    storyCount: countMap[author._id.toString()] || 0,
  }));
}

// ---------------------------------------------------------------------------
// Reader accounts (role: user)
// ---------------------------------------------------------------------------

export async function listUsers() {
  const users = await User.find({ role: "user" }).sort({ createdAt: -1 }).lean();

  users.forEach((user) => {
    delete user.auth;
  });

  return users;
}

export async function listStories() {
  return Story.find()
    .populate("author", "fullName avatar")
    .sort({ createdAt: -1 })
    .lean();
}

/** Toggle the featured flag that powers the "featured" story rail. */
export async function setStoryFeatured({ storyId, featured }) {
  const story = await Story.findById(storyId);

  if (!story) {
    throw notFoundError("Story not found.");
  }

  story.featured = Boolean(featured);
  await story.save();

  return story;
}

/** Take a published story offline without touching the author's draft. */
export async function unpublishStory({ storyId }) {
  const story = await Story.findById(storyId);

  if (!story) {
    throw notFoundError("Story not found.");
  }

  story.status = "draft";
  await story.save();

  return story;
}

/** Remove a story and every like and comment hanging off it. */
export async function deleteStory({ storyId }) {
  const story = await Story.findById(storyId);

  if (!story) {
    throw notFoundError("Story not found.");
  }

  await Like.deleteMany({ story: story._id });
  await Comment.deleteMany({ story: story._id });
  await story.deleteOne();
}

/** Suspend or reinstate a reader account. */
export async function setUserStatus({ userId, status }) {
  if (!["active", "suspended"].includes(status)) {
    throw validationError("Status must be active or suspended.");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw notFoundError("User not found.");
  }

  user.status = status;
  await user.save();

  return user;
}

// ---------------------------------------------------------------------------
// Expert applications
// ---------------------------------------------------------------------------

export async function listPendingExperts() {
  const experts = await User.find({
    roles: "expert",
    "expert.verification.status": "pending",
  })
    .sort({ createdAt: 1 })
    .lean();

  return experts.map(flattenUser);
}

export async function approveExpert({ expertId }) {
  const expert = await User.findOne({ _id: expertId, roles: "expert" });

  if (!expert) {
    throw notFoundError("Expert not found.");
  }

  const expertProfile = expert.expert || (expert.expert = {});

  expertProfile.verification = expertProfile.verification || {};
  expertProfile.verification.status = "approved";
  expertProfile.verification.verifiedAt = new Date();
  expertProfile.verification.rejectionReason = "";

  await expert.save();

  sendApplicationApproved(expert.email, expert.fullName, "expert");

  return expert;
}

export async function rejectExpert({ expertId, reason }) {
  if (!reason?.trim()) {
    throw validationError("Rejection reason is required.");
  }

  const expert = await User.findOne({ _id: expertId, roles: "expert" });

  if (!expert) {
    throw notFoundError("Expert not found.");
  }

  const expertProfile = expert.expert || (expert.expert = {});

  expertProfile.verification = expertProfile.verification || {};
  expertProfile.verification.status = "rejected";
  expertProfile.verification.verifiedAt = new Date();
  expertProfile.verification.rejectionReason = reason.trim();

  await expert.save();

  sendApplicationRejected(
    expert.email,
    expert.fullName,
    reason.trim(),
    "expert",
  );

  return expert;
}

export async function listApprovedExperts() {
  const experts = await User.find({
    roles: "expert",
    "expert.verification.status": "approved",
  })
    .sort({ createdAt: -1 })
    .lean();

  return experts.map(flattenUser);
}
