/** Shared field styling, so every input on the page looks the same. */
export const inputCls =
  "w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-all";

/**
 * How each image slot is cropped. The avatar is a circle; the cover is a
 * single 16:9 image used on every screen size.
 */
export const CROP_SPECS = {
  avatar: {
    aspect: 1,
    circular: true,
    title: "Crop your profile photo",
    hint: "This is how your photo appears in the circular avatar.",
  },
  cover: {
    aspect: 16 / 9,
    circular: false,
    title: "Position your cover image",
    hint: "Drag to choose which part shows — the frame stays 16:9 on every screen.",
  },
};

export const SOCIAL_FIELDS = [
  { key: "website", label: "Website" },
  { key: "x", label: "X (Twitter)" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
];

export const GENDERS = ["Male", "Female", "Other"];

/** The fields publishing depends on — everything else is optional. */
const REQUIRED_FOR_COMPLETION = [
  { key: "profession", label: "profession" },
  { key: "bio", label: "bio" },
  { key: "phone", label: "phone" },
  { key: "dob", label: "date of birth" },
  { key: "gender", label: "gender" },
];

export function emptyProfileForm() {
  return {
    profession: "",
    bio: "",
    phone: "",
    dob: "",
    gender: "",
    address: { country: "", state: "", city: "", zipCode: "" },
    socialLinks: {
      website: "",
      x: "",
      instagram: "",
      facebook: "",
      linkedin: "",
      youtube: "",
    },
  };
}

/** The form as it opens: the author's current profile. */
export function profileForm(author) {
  const empty = emptyProfileForm();
  if (!author) return empty;

  return {
    profession: author.profession || "",
    bio: author.bio || "",
    phone: author.phone || "",
    dob: author.dob ? new Date(author.dob).toISOString().slice(0, 10) : "",
    gender: author.gender || "",
    address: { ...empty.address, ...(author.address || {}) },
    socialLinks: { ...empty.socialLinks, ...(author.socialLinks || {}) },
  };
}

/** Which of the publishing-critical fields are still blank, if any. */
export function missingRequiredFields(form) {
  return REQUIRED_FOR_COMPLETION.filter(({ key }) => !String(form[key] || "").trim()).map(
    (field) => field.label,
  );
}

/**
 * The JSON body the API expects. Images are never included here — they
 * upload straight to R2 via presigned URLs and only their `{ url, key }`
 * descriptor travels in the PATCH body.
 */
export function profilePayload(form) {
  return {
    profession: form.profession,
    bio: form.bio,
    phone: form.phone,
    ...(form.dob ? { dob: form.dob } : {}),
    ...(form.gender ? { gender: form.gender } : {}),
    address: form.address,
    socialLinks: form.socialLinks,
  };
}
