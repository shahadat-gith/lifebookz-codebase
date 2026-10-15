import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { CONSULT_CATEGORY_IDS } from "../constants/expert.constants.js";

// ---------------------------------------------------------------------------
// Shared inline shapes (previously separate schema files)
// ---------------------------------------------------------------------------

/** Reference to a file stored in Cloudflare R2 (public URL + object key). */
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "", trim: true },
    key: { type: String, default: "", trim: true },
  },
  { _id: false },
);

/** Email/password credentials (hash + verification/reset state). */
const authSchema = new mongoose.Schema(
  {
    passwordHash: { type: String, required: true, select: false },

    isEmailVerified: { type: Boolean, default: false },

    emailVerificationToken: { type: String, default: "", select: false },

    emailVerificationExpires: { type: Date, select: false },

    passwordResetOTP: { type: String, default: "", select: false },

    passwordResetOTPExpires: { type: Date, select: false },

    passwordResetVerified: { type: Boolean, default: false, select: false },

    lastLoginAt: { type: Date, select: false },
  },
  { _id: false },
);

const verificationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    verifiedAt: {
      type: Date,
    },

    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const socialLinksSchema = new mongoose.Schema(
  {
    website: { type: String, default: "", trim: true },
    x: { type: String, default: "", trim: true },
    instagram: { type: String, default: "", trim: true },
    facebook: { type: String, default: "", trim: true },
    linkedin: { type: String, default: "", trim: true },
    youtube: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    country: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    zipCode: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const statsSchema = new mongoose.Schema(
  {
    stories: { type: Number, default: 0, min: 0 },
    likes: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Author / expert sub-documents — they exist ONLY once the account actually
// holds the role; a plain `user` never stores an empty author/expert block.
// ---------------------------------------------------------------------------

const authorSchema = new mongoose.Schema(
  {
    // Publishing gate: complete profile before a story can be published.
    isProfileCompleted: { type: Boolean },

    phone: { type: String, trim: true },

    dob: { type: Date },

    gender: { type: String, enum: ["Male", "Female", "Other", null] },

    profession: { type: String, trim: true, maxlength: 100 },

    bio: { type: String, trim: true, maxlength: 2000 },

    address: { type: addressSchema },

    socialLinks: { type: socialLinksSchema },

    // Like totals a story author accumulates.
    stats: { type: statsSchema },

    // Author application state (admins approve or reject).
    verification: { type: verificationSchema, default: () => ({}) },
  },
  { _id: false },
);

const expertSchema = new mongoose.Schema(
  {
    // High level ground/domain, e.g. "Child psychology & counselling".
    expertise: { type: String, trim: true, maxlength: 200 },

    qualification: { type: String, trim: true, maxlength: 300 },

    bio: { type: String, trim: true, maxlength: 2000 },

    phone: { type: String, trim: true },

    // Categories the expert takes consultations in.
    categories: {
      type: [
        {
          type: String,
          enum: CONSULT_CATEGORY_IDS,
        },
      ],
    },

    languages: { type: [String] },

    experience: { type: Number, min: 0, max: 60 },

    price: { type: Number, min: 0 },

    rating: { type: Number, min: 0, max: 5 },

    // How many completed consultations back the rating — 0 means "no
    // ratings yet", which must render differently from a 0-star expert.
    ratingCount: { type: Number, min: 0 },

    // Number of consultations completed through the platform.
    sessions: { type: Number, min: 0 },

    /**
     * Master switch for taking new requests. Unset (or off) the expert never
     * appears in matching results — live sessions and the IN_PROGRESS busy
     * rule still apply on top of this.
     */
    isAvailable: { type: Boolean },

    // Expert application state (admins approve or reject).
    verification: { type: verificationSchema, default: () => ({}) },
  },
  { _id: false },
);

/**
 * One user table serves every portal. A light signup (email, password, name)
 * creates a `user` that carries ONLY the core fields below; the `author` /
 * `expert` blocks appear the moment the account actually becomes one.
 */
const userSchema = new mongoose.Schema(
  {
    /** Primary role — the most recent capability granted to the account.
     *  Kept in sync with `roles` below (always a member of it). */
    role: {
      type: String,
      enum: ["user", "author", "expert"],
      default: "user",
      index: true,
    },

    /**
     * Every role the account holds — upgrades ADD to this list and never
     * replace it, so one account can be a reader, an author and an expert
     * at once. `role` above mirrors the newest entry for tokens/UI.
     */
    roles: {
      type: [String],
      enum: ["user", "author", "expert"],
      default: ["user"],
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^\S+@\S+\.\S+$/,
    },

    auth: {
      type: authSchema,
      default: () => ({}),
    },

    avatar: {
      type: imageSchema,
      default: () => ({}),
    },

    /** Single 16:9 cover used on every screen size. */
    coverImage: {
      type: imageSchema,
      default: () => ({}),
    },

    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },

    // Written when the account becomes (or applies as) an author.
    author: { type: authorSchema },

    // Written when the account becomes (or applies as) an expert.
    expert: { type: expertSchema },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,

      transform(_doc, ret) {
        ret.id = ret._id;

        delete ret._id;
        delete ret.__v;

        if (ret.auth) {
          delete ret.auth.passwordHash;
          delete ret.auth.emailVerificationToken;
          delete ret.auth.emailVerificationExpires;
          delete ret.auth.passwordResetOTP;
          delete ret.auth.passwordResetOTPExpires;
          delete ret.auth.passwordResetVerified;
          delete ret.auth.lastLoginAt;
        }

        // Flat responses like the single-table days: role details surface at
        // the top level and only when the role actually exists.
        if (ret.author) Object.assign(ret, ret.author);
        if (ret.expert) Object.assign(ret, ret.expert);
        delete ret.author;
        delete ret.expert;

        return ret;
      },
    },

    toObject: {
      virtuals: true,
    },
  },
);

userSchema.index({ status: 1 });
userSchema.index({ roles: 1, "author.verification.status": 1 });
userSchema.index({ roles: 1, "expert.verification.status": 1 });
// NOTE: `roles` is an array, and MongoDB rejects indexes over two parallel
// arrays in one document — so the expert matching index keeps its scalar
// paths only (categories/rating only ever exist on expert accounts).
userSchema.index({ "expert.categories": 1, "expert.rating": -1 });
userSchema.index({ fullName: "text" });

/**
 * Invariant: `roles` always lists every held role ("user" included) and
 * `role` — the primary — is one of them. Accounts created before the
 * `roles` field existed get it derived from their stored `role`.
 */
userSchema.pre("validate", function (next) {
  if (!Array.isArray(this.roles) || this.roles.length === 0) {
    this.roles = this.role ? [this.role] : ["user"];
  }

  if (!this.roles.includes("user")) {
    this.roles.unshift("user");
  }

  if (this.role && !this.roles.includes(this.role)) {
    this.roles.push(this.role);
  }

  if (!this.role || !this.roles.includes(this.role)) {
    this.role = this.role || this.roles[this.roles.length - 1];
  }

  return next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("auth.passwordHash")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.auth.passwordHash = await bcrypt.hash(this.auth.passwordHash, salt);
    next();
  } catch (err) {
    next(err);
  }
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
