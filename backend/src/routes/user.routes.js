import { Router } from "express";

import { authenticate, authorize } from "../middleware/auth.js";

import * as user from "../controllers/user.controller.js";

const router = Router();

// Registration accepts only name/email/password — avatar/cover are chosen
// from the dashboard later via presigned uploads.
router.post("/register", user.register);

router.post("/login", user.login);

router.get("/me", authenticate, authorize("user"), user.getMe);

// avatar/cover arrive as presigned { url, key } — files go straight to R2
// from the browser (see /uploads/presign), never through this server.
router.patch("/me", authenticate, authorize("user"), user.updateMe);

router.delete("/me", authenticate, authorize("user"), user.deleteMe);

router.post("/forgot-password", user.forgotPassword);

router.post("/verify-reset-otp", user.verifyResetOTP);

router.post("/reset-password", user.resetPassword);

router.post("/logout", user.logout);

router.get("/:userId", user.getProfile);

export default router;
