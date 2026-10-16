import jwt from "jsonwebtoken";
import config from "../config/index.js";

import User from "../models/User.js";

import { authenticationError, authorizationError } from "../utils/errors.js";

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    // Covers malformed, tampered with and expired tokens alike.
    throw authenticationError("Invalid or expired token.");
  }
}

/**
 * Authentication — verifies the bearer token, then attaches the caller's
 * user (from the single user table) to `req.user` and its role to `req.role`.
 *
 * Every account type — user, author and expert — lives in the same users
 * collection, so one lookup serves all three and a token can never resolve
 * to the wrong table.
 *
 * Layering rule for every route:
 *   authenticate     → who are you?      (valid token, existing account)
 *   authorize(...)   → are you allowed?  (role gate, must come after)
 *   requireProfileComplete → author publishing gate
 *
 * The role always comes from the database — a token minted before an
 * upgrade is never allowed to keep stale permissions.
 */
export async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      throw authenticationError("Authentication required.");
    }

    const decoded = verifyToken(token);

    // Tokens are array-based: { roles: ["user", "author"], userId } —
    // `roles` is the user schema's only role field.
    const decodedRoles = Array.isArray(decoded.roles) && decoded.roles.length > 0
      ? decoded.roles
      : [];

    // Admin / developer tokens keep their dedicated shape.
    if (decoded.role === "admin" || decoded.role === "developer") {
      switch (decoded.role) {
        case "admin": {
          if (!config.admin.key || decoded.key !== config.admin.key) {
            throw authenticationError("Invalid admin token.");
          }

          req.admin = true;
          req.role = "admin";

          return next();
        }

        case "developer": {
          if (!config.developer.email || !config.developer.password) {
            throw authenticationError(
              "Developer access is not configured on this server.",
            );
          }

          req.developer = true;
          req.role = "developer";

          return next();
        }
      }
    }

    if (
      !decoded.userId ||
      !decodedRoles.some((role) => ["user", "author", "expert"].includes(role))
    ) {
      throw authenticationError("Invalid token.");
    }

    {
      const user = await User.findById(decoded.userId).select(
        "-auth.passwordHash",
      );

      if (!user) {
        throw authenticationError("Account no longer exists.");
      }

      // Accounts created before the `status` field existed are treated as active.
      if (user.status && user.status !== "active") {
        throw authenticationError(
          "This account is not active. Please contact support.",
        );
      }

      req.user = user;
      // The fresh DB roles always win — a token minted before an upgrade
      // must not keep stale permissions.
      req.roles = Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles
        : decodedRoles;
      // `req.role` (primary, = newest entry) stays for logging and
      // third-party reads; authorization itself is array-based.
      req.role = req.roles[req.roles.length - 1];

      return next();
    }
  } catch (error) {
    return next(error);
  }
}

/**
 * Optional authentication for public read routes.
 *
 * Reading a story is public, but a signed-in caller must still be
 * personalised: have I already liked this story, have I liked this comment. A
 * missing, expired or invalid token is not an error
 * here — the request simply continues as an anonymous reader.
 */
export async function optionalAuthenticate(req, _res, next) {
  const token = extractToken(req);

  if (!token) return next();

  try {
    const decoded = verifyToken(token);

    const decodedRoles = Array.isArray(decoded.roles) && decoded.roles.length > 0
      ? decoded.roles
      : [];

    if (decodedRoles.some((role) => ["user", "author", "expert"].includes(role))) {
      const user = await User.findById(decoded.userId).select(
        "-auth.passwordHash",
      );

      if (user && (!user.status || user.status === "active")) {
        req.user = user;
        req.roles = Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles
          : decodedRoles;
        req.role = req.roles[req.roles.length - 1];
      }
    }
  } catch {
    // Treated as an anonymous reader.
  }

  return next();
}

/**
 * Role gate. Must run after `authenticate`, which sets `req.role`.
 * One account can hold several roles (reader + author + expert), so the
 * gate passes when ANY of the account's roles is allowed — the primary
 * `role` is always one of them.
 */
export function authorize(...roles) {
  return function authorizeRole(req, _res, next) {
    const heldRoles =
      Array.isArray(req.roles) && req.roles.length > 0
        ? req.roles
        : req.role
          ? [req.role]
          : [];

    if (!heldRoles.some((role) => roles.includes(role))) {
      return next(
        authorizationError("You do not have permission to perform this action."),
      );
    }

    return next();
  };
}

/**
 * Publishing gate for authors: the account must be an upgraded author
 * (root-level `isAuthor`, set by the upgrade form) before a story can be
 * published. Writing, media uploads and drafts are available to everyone.
 */
export function requireProfileComplete(req, _res, next) {
  if (req.user?.isAuthor) {
    return next();
  }

  return next(
    authorizationError(
      "Please complete your profile before publishing. Fill in your profession, bio, phone, date of birth, and gender to continue.",
    ),
  );
}
