import { useRef, useState } from "react";
import { Icons } from "../../../icons";
import api from "../../../config/api";
import toast from "react-hot-toast";
import { WizardShell } from "./WizardShell";

/**
 * Step 2 — the title and the banner.
 *
 * Both are mandatory: the title names the story (and becomes its slug), the
 * banner is the cover readers scroll past in the feed. The banner uploads
 * straight to R2 via a presigned URL — only the resulting { url, key }
 * travels in the story payload.
 */
export default function TitleStep({
  story,
  onChange,
  bannerImage,
  onBannerChange,
  onContinue,
  onBack,
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const canContinue = Boolean(story.title?.trim() && bannerImage?.url && !uploading);

  async function handleBanner(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Banners must be images.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Banner must be 15 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const presignRes = await api.post("/uploads/presign", {
        contentType: file.type,
        kind: "image",
        size: file.size,
        filename: file.name,
      });
      const { uploadUrl, key, url } = presignRes.data.data;

      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error("Upload failed — please try again.");

      onBannerChange({ url, key });
      toast.success("Banner uploaded");
    } catch (err) {
      toast.error(
        err?.response?.data?.error?.message || err?.message || "Failed to upload banner",
      );
    } finally {
      setUploading(false);
    }
  }

  function removeBanner() {
    if (bannerImage?.key) {
      api.delete("/uploads", { data: { key: bannerImage.key } }).catch(() => {});
    }
    onBannerChange(null);
  }

  return (
    <WizardShell step={2} totalSteps={5} onBack={onBack}>
      <div className="space-y-6">
        {/* Title */}
        <div>
          <label
            htmlFor="story-title"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Story title <span className="text-destructive">*</span>
          </label>
          <input
            id="story-title"
            type="text"
            value={story.title || ""}
            onChange={(e) => onChange({ ...story, title: e.target.value })}
            placeholder="Give your story a title"
            maxLength={200}
            autoFocus
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            This is what readers see first — and what the story's link is built from.
          </p>
        </div>

        {/* Banner */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Icons.photo className="h-4 w-4 text-muted-foreground" />
            Banner <span className="text-destructive">*</span>
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            Every story carries a banner — it's the cover in the feed.
          </p>

          {bannerImage?.url ? (
            <div className="relative overflow-hidden rounded-xl border border-border/60">
              <img
                src={bannerImage.url}
                alt="Story banner"
                className="h-40 w-full object-cover sm:h-48"
              />
              <button
                type="button"
                onClick={removeBanner}
                aria-label="Remove banner"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card"
              >
                <Icons.close className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 sm:h-48"
            >
              {uploading ? (
                <>
                  <Icons.spinner className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Uploading banner…</span>
                </>
              ) : (
                <>
                  <Icons.upload className="h-7 w-7" />
                  <span className="text-sm font-medium">Upload a banner</span>
                  <span className="text-xs">JPG, PNG or WEBP — up to 15 MB</span>
                </>
              )}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleBanner}
          />
        </div>
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 font-display text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
          <Icons.chevronRight className="h-4 w-4" />
        </button>
        {!canContinue && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Add a title and a banner to continue.
          </p>
        )}
      </div>
    </WizardShell>
  );
}
