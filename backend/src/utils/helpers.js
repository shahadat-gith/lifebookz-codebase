import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import config from "../config/index.js";

export function generateToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: "7d" });
}

/**
 * Hash a password with the same cost the models use in their pre-save hook.
 * Needed by flows that write through an update query instead of `save()`.
 */
export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/** Compare a candidate password against a stored bcrypt hash. */
export function verifyPassword(password, hash) {
  if (!password || !hash) return false;

  return bcrypt.compare(password, hash);
}

/**
 * Flatten a stored user for API responses: the role blocks (`author`,
 * `expert`) are spread to the top level and only exist when the role does,
 * so clients read `user.profession`, `user.rating`, … exactly like before.
 * (`lean()` skips schema transforms, so this runs at every lean() result.
 * Non-lean documents are already flattened by the schema's toJSON.)
 */
export function flattenUser(user) {
  if (!user || typeof user !== "object") return user;

  const { author, expert, ...rest } = user;

  return {
    ...rest,
    ...(author || {}),
    ...(expert || {}),
    // lean() results never ran the schema's toJSON, so surface `id` here.
    ...(user._id && !user.id ? { id: String(user._id) } : {}),
  };
}

/**
 * Same reason as flattenUser: lean query results skip the schema's toJSON
 * transform, so attach `id` to any doc-shaped object (never overwrites).
 */
export function withId(doc) {
  if (!doc || typeof doc !== "object") return doc;
  if (doc.id && !doc._id) return doc;
  return { ...doc, ...(doc._id && !doc.id ? { id: String(doc._id) } : {}) };
}
