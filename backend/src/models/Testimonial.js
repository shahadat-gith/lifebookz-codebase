import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    // Snapshot of the poster's role at the time of posting, for display.
    personType: {
      type: String,
      enum: ["user", "author", "expert"],
      default: "user",
    },

    person: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },

    // Public testimonials only appear in the section once approved.
    // Auto-approved at creation for now — an admin can hide it later.
    status: {
      type: String,
      enum: ["approved", "hidden"],
      default: "approved",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_, ret) {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  },
);


const Testimonial =
  mongoose.models.Testimonial || mongoose.model("Testimonial", testimonialSchema);

export default Testimonial;
