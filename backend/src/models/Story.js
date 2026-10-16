import mongoose from "mongoose";
import slugify from "slugify";
import { nanoid } from "nanoid";

/** Reference to a file stored in Cloudflare R2 (public URL + object key). */
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "", trim: true },
    key: { type: String, default: "", trim: true },
  },
  { _id: false },
);

/** Denormalized counters so the feed never aggregates to sort. */
const statsSchema = new mongoose.Schema(
  {
    likes: { type: Number, default: 0, min: 0 },
    comments: { type: Number, default: 0, min: 0 },
    shares: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

/**
 * Media attached to a story. Files live in Cloudflare R2 — the browser
 * uploads straight there via presigned URLs (POST /uploads/presign) and the
 * body only ever carries { url, key }. Media is OPTIONAL: a story needs a
 * banner, not a gallery.
 */
const mediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["image", "video", "audio"],
      default: "image",
    },
    caption: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },
  },
  { _id: false },
);

/**
 * Story — one life story per document.
 *
 * Every story carries exactly the fields that make it queryable: its author,
 * a slug link, a banner, a category (storyType) and a chapter (chapterName),
 * and its content. The old chapter-nested lifebook is gone — the feed reads
 * one row per story.
 *
 * The storyType / chapterName values are the options the author portal
 * offers (selects on both ends). Keep model and frontend lists in sync.
 */
export const STORY_TYPES = [
  "memory",
  "life_lesson",
  "achievement",
  "advice",
  "experience",
  "disease",
  "failure",
  "other",
];

export const LIFE_CHAPTERS = [
  "Childhood",
  "School Life",
  "College Life",
  "Relationship / Love Life",
  "Career",
  "Marriage",
  "Family",
];

const storySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Copied from the author profile on publish, so the feed's profession
    // filter reads one story document instead of joining users.
    authorProfession: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    bannerImage: {
      url: {
        type: String,
        required: true,
        trim: true,
      },
      key: {
        type: String,
        required: true,
        trim: true,
      },
    },

    storyType: {
      type: String,
      enum: STORY_TYPES,
      default: "other",
      index: true,
    },

    // A chapter is a named phase of life (frontend select) the story sits in.
    // Free-form names are allowed but the portal sends the canonical list.
    chapterName: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    // Authored rich text — sanitized on every write path in the service.
    content: {
      type: String,
      default: "",
    },

    media: {
      type: [mediaSchema],
      default: [],
    },

    visibility: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "private",
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },

    language: {
      type: String,
      default: "English",
    },

    featured: {
      type: Boolean,
      default: false,
    },

    stats: {
      type: statsSchema,
      default: () => ({}),
    },

    recentLikers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        fullName: String,
        avatar: String,
      },
    ],

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },

    toObject: {
      virtuals: true,
    },
  },
);

// ---------------------------------------------------------------------------
// Indexes tuned for the queries the API actually runs:
// feed by newest, feed by type, feed by trending, per-chapter grouping and
// the author's own lists.
// ---------------------------------------------------------------------------

storySchema.index({ author: 1, status: 1, updatedAt: -1 });
storySchema.index({ author: 1, chapterName: 1, createdAt: -1 });
storySchema.index({ status: 1, visibility: 1, publishedAt: -1 });
storySchema.index({ status: 1, visibility: 1, storyType: 1, publishedAt: -1 });
storySchema.index({ status: 1, visibility: 1, "stats.likes": -1, publishedAt: -1 });
storySchema.index({ status: 1, visibility: 1, authorProfession: 1, publishedAt: -1 });

storySchema.pre("save", function () {
  // The slug follows the title so links stay predictable. Generated once —
  // renaming a published story never breaks a link that was shared.
  if (this.title && !this.slug) {
    const baseSlug = slugify(this.title, {
      lower: true,
      strict: true,
      trim: true,
    });

    this.slug = `${baseSlug}-${nanoid(8)}`;
  }

  // First publication only — re-publishing keeps the original date.
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }
});

const Story = mongoose.models.Story || mongoose.model("Story", storySchema);

export default Story;
