import User from "../models/User.js";

import {
  generateToken,
  verifyPassword,
} from "../utils/helpers.js";
import {
  authenticationError,
  conflictError,
  notFoundError,
  validationError,
} from "../utils/errors.js";
import { sendWelcomeMail } from "./mailer.service.js";
import { logger } from "./logger.service.js";
import { deleteFile } from "./upload.service.js";

// One user table, one token shape for every account type.
// The token carries the account's FULL role list — one account may be a
// reader and an author and an expert at once — so middleware authorization
// is array-based (`roles`), which is the user schema's only role field.
export function accountToken(user) {
  return generateToken({ roles: user.roles || ["user"], userId: user.id });
}

/**
 * Registration accepts only name, email and password — avatar/cover are
 * chosen from the dashboard later via presigned uploads, so account
 * creation needs no file handling at all.
 */
export async function registerUser({ email, password, fullName }) {
  if (!email || !password || !fullName) {
    throw validationError("Email, password, and full name are required.");
  }

  const existing = await User.findOne({ email });

  if (existing) {
    const message = "An account with this email already exists.";

    throw conflictError(message, { email: message });
  }

  const user = await User.create({
    email,
    auth: { passwordHash: password },
    fullName,
  });

  sendWelcomeMail({ to: user.email, name: user.fullName, role: "user" });

  return { user, token: accountToken(user) };
}

export async function loginUser({ email, password, ip }) {
  const user = await User.findOne({ email }).select("+auth.passwordHash");

  if (!user) {
    await logger.warn("Login failed — no account for this email", {
      email,
      ip,
    });

    const message = "No account found with this email.";

    throw authenticationError(message, { email: message });
  }

  const isValid = await verifyPassword(password, user.auth.passwordHash);

  if (!isValid) {
    await logger.warn("Login failed — incorrect password", {
      userId: user.id,
      email,
      ip,
    });

    const message = "Incorrect password. Try again, or reset it.";

    throw authenticationError(message, { password: message });
  }

  return { user, token: accountToken(user) };
}

export async function getUserById(userId) {
  if (!userId) {
    throw authenticationError("Authentication required.");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw notFoundError("User not found.");
  }

  return user;
}

export async function updateUser({ userId, fullName, avatar, coverImage }) {
  const user = await getUserById(userId);

  // Multipart forms can deliver missing fields as empty strings or the
  // literal "undefined"; only a real, non-blank name is an update.
  const hasName =
    typeof fullName === "string" &&
    fullName.trim() !== "" &&
    fullName.trim() !== "undefined";

  if (hasName) {
    user.fullName = fullName.trim();
  }

  // Images arrive as presigned { url, key } uploads from the dashboard.
  const replacedKeys = [];

  if (avatar !== undefined) {
    replacedKeys.push(user.avatar?.key);
    user.avatar = avatar;
  }

  // Single 16:9 cover used on every screen size
  if (coverImage !== undefined) {
    replacedKeys.push(user.coverImage?.key);
    user.coverImage = coverImage;
  }

  await user.save();

  // Replaced images are only removed once the new ones are committed.
  await Promise.all(
    replacedKeys.filter(Boolean).map((key) => deleteFile(key).catch(() => {})),
  );

  return user;
}

export async function deleteUser({ userId }) {
  const user = await getUserById(userId);

  if (user.avatar?.key) {
    await deleteFile(user.avatar.key);
  }

  await user.deleteOne();
}

export async function getPublicProfile(userId) {
  const user = await User.findById(userId)
    .select("fullName avatar coverImage createdAt role")
    .lean();

  if (!user) {
    throw notFoundError("User not found.");
  }

  return user;
}
