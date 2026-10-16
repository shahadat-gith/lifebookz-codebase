import { Router } from "express";

import { authenticate, authorize } from "../middleware/auth.js";
import * as admin from "../controllers/admin.controller.js";

const router = Router();

// Every route below the login is admin-only. `authenticate` resolves the
// caller, `authorize("admin")` keeps users, authors and experts out.
const adminOnly = [authenticate, authorize("admin")];

router.post("/login", admin.login);

router.get("/me", adminOnly, admin.getMe);

router.get("/dashboard", adminOnly, admin.dashboard);

// Authors no longer have an approval pipeline — the list below is all the
// admin sees. (Expert applications still run through approve/reject.)

router.get("/authors/approved", adminOnly, admin.getApprovedAuthors);

router.get("/experts/pending", adminOnly, admin.getPendingExperts);

router.patch("/experts/:expertId/approve", adminOnly, admin.approveExpert);

router.patch("/experts/:expertId/reject", adminOnly, admin.rejectExpert);

router.get("/experts/approved", adminOnly, admin.getApprovedExperts);

router.get("/users", adminOnly, admin.getUsers);

router.patch("/users/:userId/status", adminOnly, admin.setUserStatus);

router.get("/stories", adminOnly, admin.getStories);

router.patch("/stories/:storyId/featured", adminOnly, admin.toggleStoryFeatured);

router.patch("/stories/:storyId/unpublish", adminOnly, admin.unpublishStory);

router.delete("/stories/:storyId", adminOnly, admin.deleteStory);

router.post("/logout", admin.logout);

export default router;
