import mongoose from "mongoose";

/**
 * A reply written by the story's author. Replies are embedded on the
 * comment; only the owning story's author may create them (enforced in
 * the service layer).
 *
 * Only a reference is stored — the author's name and avatar are populated
 * on read, so a reply never shows a stale profile picture.
 */
const replySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const commentSchema = new mongoose.Schema(
  {
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      required: true,
      index: true,
    },

    /**
     * The account that wrote the comment. Every account — reader, author
     * and expert — lives in the same users collection, so a plain populate
     * returns the account's *current* name and avatar.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    edited: {
      type: Boolean,
      default: false,
    },

    /**
     * Anyone signed in (user, author or expert) can like a comment.
     * Only the count is shown; `who` alone drives the liked/not-liked
     * check for the viewer.
     */
    likes: [
      {
        who: { type: mongoose.Schema.Types.ObjectId, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    /** Author-only threaded replies. */
    replies: [replySchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        ret.id = ret._id;
        ret.likeCount = ret.likes?.length || 0;
        return ret;
      },
    },
  }
);

commentSchema.index({ story: 1, createdAt: -1 });
commentSchema.index({ user: 1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
