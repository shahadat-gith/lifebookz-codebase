import { Router } from "express";

import { authenticate, authorize } from "../middleware/auth.js";
import * as testimonial from "../controllers/testimonial.controller.js";

const router = Router();

// Public — anyone (even guests) can read approved testimonials.
router.get("/", testimonial.list);

router.post("/", authenticate, authorize("user", "author", "expert"), testimonial.create);

router.delete(
  "/:id",
  authenticate,
  authorize("user", "author", "expert", "admin"),
  testimonial.remove,
);

// Admin moderation.
router.patch(
  "/:id/status",
  authenticate,
  authorize("admin"),
  testimonial.moderate,
);

export default router;
