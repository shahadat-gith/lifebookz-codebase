import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { CONSULT_CATEGORIES } from "../../config";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import ImageCropper from "../../components/common/ImageCropper";
import { Icons } from "../../icons";
import { uploadImage } from "../../utils/uploads";
import api from "../../config/api";

/** JSON body carrying only the fields being changed. */
function buildProfilePayload({
  fullName,
  expertise,
  qualification,
  bio,
  phone,
  experience,
  price,
  languages,
  categories,
}) {
  return {
    ...(fullName !== undefined ? { fullName } : {}),
    ...(expertise !== undefined ? { expertise } : {}),
    ...(qualification !== undefined ? { qualification } : {}),
    ...(bio !== undefined ? { bio } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(experience !== undefined
      ? { experience: Math.max(0, Number(experience) || 0) }
      : {}),
    ...(price !== undefined
      ? { price: Math.max(0, Number(price) || 0) }
      : {}),
    ...(languages !== undefined
      ? {
          languages: languages
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean),
        }
      : {}),
    ...(categories !== undefined ? { categories } : {}),
  };
}

/**
 * Editing the expert's profile: the text fields save through the form, while
 * the avatar and 16:9 cover save the instant their crop is applied — the
 * same instant-save flow the client portal uses.
 */
export default function ProfileEdit() {
  const { expert, updateProfile, reloadProfile, upgradeToExpert } = useAuth();

  // user/author accounts on this portal treat the page as an expert
  // application — the whole form submits to POST /experts/upgrade.
  // Roles-aware: an upgraded account that also stays an author keeps the
  // expert capability in `roles`, so it still edits as a full expert here.
  const isApplication = Boolean(
    expert &&
      expert.role !== "expert" &&
      !(Array.isArray(expert.roles) && expert.roles.includes("expert")),
  );

  const [form, setForm] = useState({
    fullName: expert?.fullName || "",
    expertise: expert?.expertise || "",
    qualification: expert?.qualification || "",
    bio: expert?.bio || "",
    phone: expert?.phone || "",
    experience: expert?.experience ?? 0,
    price: expert?.price ?? 0,
    languages: (expert?.languages || []).join(", "),
    categories: expert?.categories || [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null); // 'avatar' | 'cover'

  // Pending crop: { kind: 'avatar' | 'cover', src }
  const [cropping, setCropping] = useState(null);

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const setField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isDirty = useMemo(
    () =>
      form.fullName.trim() !== (expert?.fullName || "") ||
      form.expertise.trim() !== (expert?.expertise || "") ||
      form.qualification.trim() !== (expert?.qualification || "") ||
      form.bio !== (expert?.bio || "") ||
      form.phone.trim() !== (expert?.phone || "") ||
      Number(form.experience) !== (expert?.experience ?? 0) ||
      Number(form.price) !== (expert?.price ?? 0) ||
      form.languages !== (expert?.languages || []).join(", ") ||
      JSON.stringify(form.categories) !== JSON.stringify(expert?.categories || []),
    [form, expert],
  );

  useEffect(() => {
    if (!expert) return;
    setForm({
      fullName: expert.fullName || "",
      expertise: expert.expertise || "",
      qualification: expert.qualification || "",
      bio: expert.bio || "",
      phone: expert.phone || "",
      experience: expert.experience ?? 0,
      price: expert.price ?? 0,
      languages: (expert.languages || []).join(", "),
      categories: expert.categories || [],
    });
  }, [expert]);

  /** Pick a file and open the cropper for that slot. */
  const handleFilePicked = (kind, e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Images must be 15 MB or smaller.");
      return;
    }

    setCropping({ kind, src: URL.createObjectURL(file) });
  };

  const cancelCrop = () => {
    if (cropping?.src?.startsWith("blob:")) URL.revokeObjectURL(cropping.src);
    setCropping(null);
  };

  /* ---------- Images: crop, then upload right away ---------- */
  const handleCropped = async (blob) => {
    const kind = cropping?.kind;
    cancelCrop();
    if (!kind) return;

    setUploading(kind);
    try {
      // Upload the cropped image straight to R2, then hand only its
      // { url, key } descriptor to a profile endpoint.
      const imageRef = await uploadImage(blob, kind);

      if (isApplication) {
        // The account isn't an expert yet, so PATCH /experts/me would be a
        // 403 — the shared account profile (avatar + cover) saves instantly
        // through the reader profile endpoint instead.
        await api.patch(
          "/users/me",
          kind === "avatar" ? { avatar: imageRef } : { coverImage: imageRef },
        );
        await reloadProfile();
      } else {
        await updateProfile(
          kind === "avatar" ? { avatar: imageRef } : { coverImage: imageRef },
        );
      }

      toast.success(
        kind === "avatar" ? "Profile photo updated." : "Cover image updated.",
      );
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message ||
          "We couldn't save your image. Please try again.",
      );
    } finally {
      setUploading(null);
    }
  };

  const toggleCategory = (id) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter((c) => c !== id)
        : [...prev.categories, id],
    }));
  };

  async function handleSubmit(e) {
    e.preventDefault();

    if (form.categories.length === 0) {
      toast.error("Keep at least one consultancy category selected.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildProfilePayload(form);

      if (isApplication) {
        await upgradeToExpert(payload);
        toast.success("Expert application submitted — pending verification.");
      } else {
        await updateProfile(payload);
        toast.success("Profile updated.");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message || "Failed to update profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!expert) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground md:py-16">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Back to the read-only profile */}
        <button
          type="button"
          onClick={() => history.back()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icons.arrowLeft className="h-4 w-4" />
          Back to Profile
        </button>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
            {isApplication ? "Become an Expert" : "Edit Profile"}
          </h1>
          {isApplication && (
            <p className="text-sm text-muted-foreground">
              You're signed in as a {"reader"} account. Complete your
              professional details to start taking consultancy sessions — your
              application goes for verification once submitted.
            </p>
          )}
        </div>

        {/* Identity card, live — camera buttons open the pickers below */}
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
          <div className="relative aspect-video bg-gradient-to-r from-primary via-primary to-accent/70">
            {expert.coverImage?.url ? (
              <img
                src={expert.coverImage.url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center text-primary-foreground/80 transition-colors hover:text-primary-foreground"
              >
                <Icons.photo className="h-5 w-5" />
                <span className="mt-0.5 text-xs">Add a cover image</span>
              </button>
            )}

            {expert.coverImage?.url && (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                aria-label="Change cover image"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm transition-colors hover:bg-card"
              >
                <Icons.camera className="h-4 w-4" />
              </button>
            )}

            {uploading === "cover" && (
              <div className="absolute inset-0 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
                <Icons.spinner className="h-6 w-6 animate-spin text-primary-foreground" />
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-4 px-5 pb-6 sm:flex-row sm:items-end sm:gap-6 sm:px-7">
            <div className="relative z-10 -mt-10 shrink-0 sm:-mt-12">
              <div className="relative">
                <img
                  src={expert.avatar?.url?.trim() || "/user.png"}
                  alt={expert.fullName || "Your avatar"}
                  className="h-24 w-24 rounded-full border-4 border-card bg-muted/40 object-cover shadow-md sm:h-28 sm:w-28"
                />

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  aria-label="Change profile photo"
                  className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted active:scale-95"
                >
                  {uploading === "avatar" ? (
                    <Icons.spinner className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Icons.camera className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="min-w-0 flex-1 pb-1 text-center sm:text-left">
              <h2 className="truncate font-display text-xl font-extrabold text-foreground sm:text-2xl">
                {expert.fullName}
              </h2>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {expert.email}
              </p>
            </div>
          </div>
        </section>

        {/* Form — text fields save through the Save button */}
        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs sm:p-7">
            <div className="mb-5">
              <h2 className="font-display text-lg font-bold text-foreground">
                Professional details
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Saving regenerates your matching profile so you keep appearing
                in the right searches.
              </p>
            </div>

            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Full Name"
                  value={form.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  required
                  icon={<Icons.user className="h-4 w-4" />}
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  icon={<Icons.phone className="h-4 w-4" />}
                />
              </div>

              <Input
                label="Email"
                value={expert.email}
                disabled
                helperText="Email cannot be changed"
              />

              <Input
                label="Area of expertise"
                value={form.expertise}
                onChange={(e) => setField("expertise", e.target.value)}
                placeholder="Enter your area of expertise"
                icon={<Icons.academic className="h-4 w-4" />}
                required
              />

              <Input
                label="Qualification"
                value={form.qualification}
                onChange={(e) => setField("qualification", e.target.value)}
                placeholder="Enter your qualification"
                icon={<Icons.shieldCheck className="h-4 w-4" />}
                required
              />

              <div className="grid gap-5 sm:grid-cols-3">
                <Input
                  label="Years of experience"
                  type="number"
                  min="0"
                  max="60"
                  value={form.experience}
                  onChange={(e) => setField("experience", e.target.value)}
                  icon={<Icons.clock className="h-4 w-4" />}
                />
                <Input
                  label="Session price (₹)"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  icon={<Icons.money className="h-4 w-4" />}
                />
                <Input
                  label="Languages"
                  value={form.languages}
                  onChange={(e) => setField("languages", e.target.value)}
                  placeholder="Enter languages you speak"
                  icon={<Icons.globe className="h-4 w-4" />}
                />
              </div>

              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Consultancy categories
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {CONSULT_CATEGORIES.map((cat) => {
                    const checked = form.categories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                          checked
                            ? "border-accent bg-accent/10 text-foreground"
                            : "border-border/70 text-muted-foreground hover:border-accent/40 hover:text-foreground"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                            checked
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-border"
                          }`}
                        >
                          {checked && <Icons.check className="h-3 w-3" />}
                        </span>
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Textarea
                label="Bio"
                value={form.bio}
                onChange={(e) => setField("bio", e.target.value)}
                rows={5}
                placeholder="Describe how you help people"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-5">
              {isDirty && !saving && (
                <span className="mr-auto text-xs font-medium text-muted-foreground">
                  You have unsaved changes.
                </span>
              )}

              <button
                type="submit"
                disabled={!isDirty || saving}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </form>

        {/* One input per slot, opened by the card's camera buttons */}
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFilePicked("avatar", e)}
          className="hidden"
        />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFilePicked("cover", e)}
          className="hidden"
        />

        {/* Crop dialog — avatar (1:1, circular) or the 16:9 cover */}
        {cropping && (
          <ImageCropper
            imageSrc={cropping.src}
            aspect={cropping.kind === "avatar" ? 1 : 16 / 9}
            circular={cropping.kind === "avatar"}
            title={
              cropping.kind === "avatar"
                ? "Crop your profile photo"
                : "Position your cover image"
            }
            hint={
              cropping.kind === "avatar"
                ? "This is how your photo appears in the circular avatar."
                : "Drag to choose which part shows — the frame stays 16:9 on every screen."
            }
            onCropped={handleCropped}
            onCancel={cancelCrop}
          />
        )}
      </div>
    </div>
  );
}
