import crypto from "crypto";

import User from "../models/User.js";

import { hashPassword } from "../utils/helpers.js";
import { validationError } from "../utils/errors.js";
import { sendOtpMail } from "./mailer.service.js";

const RESET_SELECT =
  "+auth.passwordResetOTP +auth.passwordResetOTPExpires +auth.passwordResetVerified";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * Password reset for every account, driven by the email address alone —
 * one user table makes the flow identical for readers, authors and experts.
 */
export async function requestPasswordReset({ email, role = "user" }) {
  if (!email) {
    throw validationError("Email is required.");
  }

  // Always resolve silently to avoid revealing whether the email exists
  const user = await User.findOne({ email }).select("email");

  if (!user) return;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Targeted write on purpose. Resetting a password only touches `auth`, so it
  // must not re-validate the rest of the profile — a document predating a
  // `required` field would otherwise be locked out of its own reset.
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        "auth.passwordResetOTP": otp,
        "auth.passwordResetOTPExpires": new Date(Date.now() + OTP_TTL_MS),
        "auth.passwordResetVerified": false,
      },
    },
  );

  await sendOtpMail({ to: user.email, otp, role });
}

export async function verifyPasswordResetOTP({ email, otp }) {
  if (!email || !otp) {
    throw validationError("Email and OTP are required.");
  }

  const user = await User.findOne({ email }).select(`email ${RESET_SELECT}`);

  if (
    !user ||
    user.auth.passwordResetOTP !== otp ||
    !user.auth.passwordResetOTPExpires ||
    user.auth.passwordResetOTPExpires < new Date()
  ) {
    throw validationError("Invalid or expired OTP.");
  }

  // Verified marks that the reset token — not the OTP — is the credential the
  // next step accepts, so the short-lived token replaces the OTP here.
  const resetToken = crypto.randomBytes(32).toString("hex");

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        "auth.passwordResetVerified": true,
        "auth.passwordResetOTP": resetToken,
        "auth.passwordResetOTPExpires": new Date(
          Date.now() + RESET_TOKEN_TTL_MS,
        ),
      },
    },
  );

  return resetToken;
}

export async function resetPassword({ resetToken, password }) {
  if (!resetToken || !password) {
    throw validationError("Reset token and new password are required.");
  }

  if (password.length < 8) {
    throw validationError("Password must be at least 8 characters.");
  }

  // Hashing happens here because the write below is a targeted update, so the
  // model's pre-save hook never runs.
  const passwordHash = await hashPassword(password);

  // One atomic write: match on the token, swap in the hash and drop the token.
  // Two concurrent submissions of the same token cannot both succeed.
  const result = await User.updateOne(
    {
      "auth.passwordResetOTP": resetToken,
      "auth.passwordResetOTPExpires": { $gt: new Date() },
      "auth.passwordResetVerified": true,
    },
    {
      $set: {
        "auth.passwordHash": passwordHash,
        "auth.passwordResetVerified": false,
      },
      $unset: {
        "auth.passwordResetOTP": "",
        "auth.passwordResetOTPExpires": "",
      },
    },
  );

  if (result.matchedCount === 0) {
    throw validationError(
      "Invalid or expired reset token. Please request a new OTP.",
    );
  }
}
