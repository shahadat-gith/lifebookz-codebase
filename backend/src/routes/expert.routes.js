import { Router } from "express";

import { authenticate, authorize } from "../middleware/auth.js";

import * as expert from "../controllers/expert.controller.js";

const router = Router();

// Sign-up lives in the client portal — one account serves every portal —
// so this portal only ever logs existing accounts in. Becoming an expert
// happens through `/upgrade` once the dashboard invites the account to
// complete its expert profile.
router.post("/upgrade", authenticate, authorize("user", "author"), expert.upgrade);

router.post("/login", expert.login);

// The application state must be readable by anyone signed in through this
// portal — the dashboard itself tells them what is still missing.
router.get("/me", authenticate, authorize("user", "author", "expert"), expert.getMe);

// avatar/cover arrive as presigned { url, key } — files go straight to R2
// from the browser (see /uploads/presign), never through this server.
router.patch("/me", authenticate, authorize("expert"), expert.updateMe);

router.get("/me/bookings", authenticate, authorize("expert"), expert.getMyBookings);

router.patch("/me/availability", authenticate, authorize("expert"), expert.setAvailability);

router.post("/forgot-password", expert.forgotPassword);

router.post("/verify-reset-otp", expert.verifyResetOTP);

router.post("/reset-password", expert.resetPassword);

router.post("/logout", expert.logout);

router.get("/:expertId", expert.getProfile);

export default router;
