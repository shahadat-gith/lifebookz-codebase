import { Router } from "express";

import {
  authenticate,
  authorize,
  optionalAuthenticate,
  requireProfileComplete,
} from "../middleware/auth.js";
import * as story from "../controllers/story.controller.js";

const router = Router();

// Writing is open to any signed-in account: a reader can start a story,
// and the author role is granted at publish time through the upgrade
// form — no separate application step.
const authorOnly = [authenticate, authorize("user", "author", "expert")];
// Any signed-in account can read along: liking, commenting and sharing a
// story are reader actions, and authors read each other's stories too.
const anyAccount = [authenticate, authorize("user", "author", "expert")];

// File bytes never reach this server — every upload (banner, story media,
// avatars, covers) is uploaded straight to R2 via a presigned URL, and only
// the resulting { url, key } pair travels in the JSON body.
router.post("/", authorOnly, story.create);

// Reading is public — anyone can browse the feed and read published stories.
// Optional auth personalises them for a signed-in caller (liked)
// without ever blocking an anonymous one.
router.get("/", optionalAuthenticate, story.list);

// Vocabulary for the circular feed filters + the author select.
router.get("/types", story.getTypes);

// Distinct author professions — the filter modal's options.
router.get("/professions", story.getProfessions);

// Curated rails for the home screens (web + mobile) — no paging needed.
router.get("/latest", optionalAuthenticate, story.getLatest);
router.get("/trending", optionalAuthenticate, story.getTrending);

router.get("/drafts", authorOnly, story.getDrafts);
router.get("/mine", authorOnly, story.getMine);

router.get("/:storyId", optionalAuthenticate, story.getStory);
router.patch("/:storyId", authorOnly, story.update);

// Full author control — delete any time, even after publish
router.delete("/:storyId", authorOnly, story.remove);

// Publishing additionally requires the author's profile to be complete.
router.post(
  "/:storyId/publish",
  authorOnly,
  requireProfileComplete,
  story.publish,
);

router.post("/:storyId/unpublish", authorOnly, story.unpublish);

router.post("/:storyId/like", anyAccount, story.toggleLike);

// Comments are publicly readable (optionally personalised for signed-in
// callers: likedByMe, own comments)
router.get("/:storyId/comments", optionalAuthenticate, story.getComments);

router.post("/:storyId/comments", anyAccount, story.createComment);

// Comment likes — any signed-in account (user, author or expert)
router.post(
  "/comments/:commentId/like",
  authenticate,
  authorize("user", "author", "expert"),
  story.toggleCommentLike,
);

// Replies — the story's author only
router.post(
  "/comments/:commentId/reply",
  authenticate,
  authorize("author"),
  story.replyToComment,
);

router.patch("/comments/:commentId", anyAccount, story.updateComment);

router.delete("/comments/:commentId", anyAccount, story.deleteComment);

export default router;
