import { Router } from "express";

import { authenticate, authorize, optionalAuthenticate } from "../middleware/auth.js";

import * as author from "../controllers/author.controller.js";

const router = Router();

// Sign-up lives in the client portal — one account serves every portal —
// so this portal only ever logs existing accounts in.
router.post("/login", author.login);

// `me` is readable by any signed-in account: a plain user who opens the
// author portal still gets their (author-less) profile back, which is what
// the upgrade form reads before granting the author role.
router.get("/me", authenticate, authorize("user", "author", "expert"), author.getMe);

// avatar/cover arrive as presigned { url, key } — files go straight to R2
// from the browser (see /uploads/presign), never through this server.
router.patch("/me", authenticate, authorize("author"), author.updateMe);

// Deliberate upgrade — grants the author role from the publish-time form.
// No admin review: submitting the required fields IS the upgrade.
router.patch("/me/upgrade",
  authenticate,
  authorize("user", "author", "expert"),
  author.upgradeMe,
);

router.get("/me/stories", authenticate, authorize("author"), author.getMyStories);

// Same list with the rich-text content stripped — list views only.
router.get("/me/stories/summaries",
  authenticate,
  authorize("author"),
  author.getMyStorySummaries,
);

router.get("/me/stats", authenticate, authorize("author"), author.getMyStats);

router.get("/me/stories/:storyId",
  authenticate,
  authorize("author"),
  author.getMyStory,
);

router.post("/forgot-password", author.forgotPassword);

router.post("/verify-reset-otp", author.verifyResetOTP);

router.post("/reset-password", author.resetPassword);

router.post("/logout", author.logout);

router.get("/approved", author.listApproved);

// Public profile, readable by anonymous visitors too.
router.get("/:authorId", optionalAuthenticate, author.getProfile);

export default router;
