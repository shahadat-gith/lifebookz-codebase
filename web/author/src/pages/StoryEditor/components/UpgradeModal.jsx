import { useState } from "react";
import { motion } from "framer-motion";
import api from "../../../config/api";
import { Icons } from "../../../icons";
import toast from "react-hot-toast";

const GENDERS = ["Male", "Female", "Other"];

const REQUIRED = [
  { key: "profession", label: "Profession", type: "text", placeholder: "e.g. Teacher, Engineer" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "10-digit phone number" },
];

/**
 * The publish-time author upgrade.
 *
 * Shown when pressing Publish on an account that isn't upgraded yet: it
 * collects the publishing-critical profile fields (profession, bio, phone,
 * date of birth, gender) and calls PATCH /authors/me/upgrade — no admin
 * review, the submission itself completes the profile. SUBMIT ONLY
 * UPGRADES: the modal closes, the author stays on the publish step and
 * clicks Publish themselves.
 */
export default function UpgradeModal({ author, onUpgraded, onClose }) {
  const [form, setForm] = useState({
    profession: author?.profession || "",
    bio: author?.bio || "",
    phone: author?.phone || "",
    dob: author?.dob ? String(author.dob).slice(0, 10) : "",
    gender: author?.gender || "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const incomplete = [
    form.profession.trim(),
    form.bio.trim(),
    form.phone.trim(),
    form.dob,
    form.gender,
  ].some((value) => !value);

  async function handleSubmit(e) {
    e.preventDefault();
    if (incomplete || saving) return;

    setSaving(true);
    try {
      const res = await api.patch("/authors/me/upgrade", form);
      const { author: upgraded, token } = res.data.data;

      if (token) {
        try {
          localStorage.setItem("token", token);
        } catch {
          /* storage unavailable — session restores from the API instead */
        }
      }

      toast.success("Profile upgraded to author");
      onUpgraded(upgraded);
    } catch (err) {
      toast.error(
        err?.response?.data?.error?.message ||
          "Could not complete the upgrade. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const fieldCls =
    "w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-card p-6 shadow-xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <Icons.close className="h-4 w-4" />
        </button>

        <div className="text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icons.book className="h-6 w-6 text-primary" />
          </span>
          <h2 className="font-display text-xl font-bold text-foreground">
            Become an author
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Fill in these details once to complete your author profile.
            After submitting, press Publish again to publish your story.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {REQUIRED.map(({ key, label, type, placeholder }) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {label} *
              </span>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                required
                className={fieldCls}
              />
            </label>
          ))}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Date of birth *
            </span>
            <input
              type="date"
              value={form.dob}
              onChange={(e) => set("dob", e.target.value)}
              required
              className={fieldCls}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Gender *
            </span>
            <select
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              required
              className={`${fieldCls} appearance-none`}
            >
              <option value="">Select gender</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Short bio *
            </span>
            <textarea
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="A line or two about you — shown with every story you publish."
              rows={3}
              maxLength={2000}
              required
              className={`${fieldCls} resize-none`}
            />
          </label>

          <button
            type="submit"
            disabled={incomplete || saving}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 font-display text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Icons.spinner className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Icons.shieldCheck className="h-4 w-4" />
                Submit details
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-muted-foreground">
            No admin approval — submitting these details completes your
            author profile immediately.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
