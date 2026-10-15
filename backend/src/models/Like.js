import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      required: true,
      index: true,
    },

    /**
     * The account that liked the story. Readers, authors and experts all
     * live in the same users collection, so the liker's details are
     * populated from `User` on read rather than copied here.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        ret.id = ret._id;
        return ret;
      },
    },
  }
);

likeSchema.index({ story: 1, user: 1 }, { unique: true });

const Like = mongoose.model("Like", likeSchema);

export default Like;