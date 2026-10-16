import * as authorService from "../services/author.service.js";
import * as passwordReset from "../services/passwordReset.service.js";
import { parseImageRef } from "../utils/media.js";

export async function login(req, res, next) {
  try {
    const { author, token } = await authorService.loginAuthor({
      email: req.body.email,
      password: req.body.password,
      ip: req.ip,
    });

    return res.json({
      success: true,
      data: { author, token },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const author = await authorService.getMyAuthorProfile(req.user?.id);

    return res.json({ success: true, data: author });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /authors/me/upgrade — deliberate author upgrade from the publish
 * flow. Signs the account up as a publishing author (no admin review) once
 * the required profile fields are present, and returns a refreshed token
 * carrying the new roles array.
 */
export async function upgradeMe(req, res, next) {
  try {
    const { user, alreadyAuthor } = await authorService.upgradeToAuthor({
      userId: req.user?.id,
      body: req.body,
    });

    const { accountToken } = await import("../services/user.service.js");

    return res.json({
      success: true,
      message: alreadyAuthor
        ? "You are already an author."
        : "You're an author now — your profile is complete.",
      data: { author: user, token: accountToken(user) },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMe(req, res, next) {
  try {
    const author = await authorService.updateAuthor({
      userId: req.user?.id,
      body: req.body,
      avatar: parseImageRef(req.body.avatar, "avatar"),
      coverImage: parseImageRef(req.body.coverImage, "coverImage"),
    });

    return res.json({ success: true, data: author });
  } catch (error) {
    next(error);
  }
}

export async function getMyStories(req, res, next) {
  try {
    const stories = await authorService.listMyStories({
      authorId: req.user?.id,
    });

    return res.json({ success: true, data: stories });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /authors/me/stories/summaries — every story, content stripped.
 * List views (profile tabs, dashboard tiles) render almost entirely from
 * banner/title/meta, so skipping the heavy HTML shrinks the payload.
 */
export async function getMyStorySummaries(req, res, next) {
  try {
    const stories = await authorService.listMyStorySummaries({
      authorId: req.user?.id,
    });

    return res.json({ success: true, data: stories });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /authors/me/stats
 */
export async function getMyStats(req, res, next) {
  try {
    const data = await authorService.getMyAuthorStats({
      authorId: req.user?.id,
    });

    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getMyStory(req, res, next) {
  try {
    const story = await authorService.getMyStory({
      authorId: req.user?.id,
      storyId: req.params.storyId,
    });

    return res.json({ success: true, data: story });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req, res, next) {
  try {
    const author = await authorService.getPublicAuthor({
      authorId: req.params.authorId,
      viewerId: req.user?.id,
    });

    return res.json({ success: true, data: author });
  } catch (error) {
    next(error);
  }
}

export async function listApproved(_req, res, next) {
  try {
    const authors = await authorService.listApprovedAuthors();

    return res.json({ success: true, data: authors });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    await passwordReset.requestPasswordReset({ email: req.body.email, role: "author" });

    return res.json({
      success: true,
      message:
        "If an account with that email exists, an OTP has been sent. Please check your inbox and spam folder.",
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyResetOTP(req, res, next) {
  try {
    const resetToken = await passwordReset.verifyPasswordResetOTP({
      email: req.body.email,
      otp: req.body.otp,
    });

    return res.json({
      success: true,
      data: { resetToken },
      message: "OTP verified. You can now reset your password.",
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await passwordReset.resetPassword({
      resetToken: req.body.resetToken,
      password: req.body.password,
    });

    return res.json({
      success: true,
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(_req, res, next) {
  try {
    return res.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    next(error);
  }
}
