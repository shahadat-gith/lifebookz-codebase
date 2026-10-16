import Testimonial from "../models/Testimonial.js";
import { withId } from "../utils/helpers.js";
import {
  forbiddenError,
  notFoundError,
  validationError,
} from "../utils/errors.js";

const PERSON_SELECT = "fullName avatar profession";

/**
 * Latest testimonials, newest first. Docs created before the status field
 * existed have no `status`; treat anything not explicitly hidden as visible.
 */
export async function listTestimonials({ limit } = {}) {
  const safeLimit = Math.min(Number(limit) || 20, 50);

  const testimonials = await Testimonial.find({ status: { $ne: "hidden" } })
    .populate("person", PERSON_SELECT)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();

  return testimonials.map(withId);
}

/**
 * Any signed-in account can leave one testimonial — one user table, so the
 * person is unique regardless of role.
 */
export async function createTestimonial({ role, userId, message, rating }) {
  if (!message?.trim()) {
    throw validationError("Testimonial message is required.");
  }

  if (!userId || !["user", "author", "expert"].includes(role)) {
    throw forbiddenError(
      "Only signed-in accounts can post testimonials.",
    );
  }

  // One testimonial per person — submitting again UPDATES the existing
  // entry instead of erroring (the UI presents it as "Update Testimonial").
  const existing = await Testimonial.findOne({ person: userId });
  if (existing) {
    existing.message = message.trim().slice(0, 1000);
    existing.rating = rating ? Math.min(Math.max(Number(rating), 1), 5) : existing.rating;
    await existing.save();

    return withId(
      (await Testimonial.findById(existing.id)
        .populate("person", PERSON_SELECT)
        .lean()) || null,
    );
  }

  const testimonial = await Testimonial.create({
    personType: role,
    person: userId,
    message: message.trim().slice(0, 1000),
    rating: rating ? Math.min(Math.max(Number(rating), 1), 5) : 5,
  });

  return withId(
    (await Testimonial.findById(testimonial.id)
      .populate("person", PERSON_SELECT)
      .lean()) || null,
  );
}

/**
 * Admins and the testimonial owner can remove a testimonial.
 */
export async function deleteTestimonial({ id, userId, isAdmin }) {
  const testimonial = await Testimonial.findById(id);

  if (!testimonial) {
    throw notFoundError("Testimonial not found.");
  }

  const isOwner = userId && testimonial.person.toString() === userId.toString();

  if (!isAdmin && !isOwner) {
    throw forbiddenError("You cannot delete this testimonial.");
  }

  await testimonial.deleteOne();
}

/**
 * Admin moderation — hide or re-approve a testimonial.
 */
export async function moderateTestimonial({ id, status }) {
  if (!["approved", "hidden"].includes(status)) {
    throw validationError("Invalid status.");
  }

  const testimonial = await Testimonial.findByIdAndUpdate(
    id,
    { status },
    { new: true },
  ).populate("person", PERSON_SELECT);

  if (!testimonial) {
    throw notFoundError("Testimonial not found.");
  }

  return withId(testimonial.toObject ? testimonial.toObject() : testimonial);
}
