import { useRef, useState } from "react";
import { Icons } from "../../../icons";
import { WizardShell } from "./WizardShell";
import api from "../../../config/api";
import toast from "react-hot-toast";

const TABS = [
  { key: "image", label: "Photos" },
  { key: "video", label: "Videos" },
];

const ACCEPT = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4,video/quicktime,video/webm,video/x-matroska",
};

const LIMITS = {
  image: { mb: 15, label: "Photos" },
  video: { mb: 500, label: "Videos" },
};

/**
 * Upload one file DIRECTLY to R2 via a presigned PUT URL, reporting real
 * progress through XMLHttpRequest's upload event (fetch cannot observe
 * upload bytes). onProgress fires with 0–100 as bytes leave the browser;
 * resolves with the stored descriptor.
 */
function uploadViaPresign(file, kind, onProgress) {
  return new Promise((resolve, reject) => {
    api
      .post("/uploads/presign", {
        contentType: file.type,
        kind,
        size: file.size,
        filename: file.name,
      })
      .then((presignRes) => {
        const { uploadUrl, url, key } = presignRes.data.data;

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        // Bytes actually sent — fires continuously, so the bar moves.
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ url, key, type: kind, caption: "" });
          } else {
            reject(new Error("Upload failed — please try again."));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed — please try again."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));

        onProgress(0);
        xhr.send(file);
      })
      .catch(reject);
  });
}

/**
 * One in-flight upload tile: a thumbnail slot with a live progress bar and
 * its percentage, standing in until the descriptor replaces it.
 */
function UploadTile({ job }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted">
      {/* Placeholder while the bytes travel */}
      <div className="flex h-full w-full items-center justify-center">
        <Icons.photo className="h-6 w-6 text-muted-foreground/40" />
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 px-3">
        <span className="font-display text-sm font-bold text-foreground">
          {job.progress}%
        </span>
        <div className="h-1.5 w-full max-w-[80%] overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${job.progress}%` }}
          />
        </div>
        <span className="max-w-full truncate text-[10px] text-muted-foreground">
          {job.name}
        </span>
      </div>
    </div>
  );
}

/**
 * Step 4 — the optional gallery. Images and videos only: a story publishes
 * fine with no media at all, and earlier uploads can be removed one by one.
 * Every upload shows its real-time progress as it goes to R2.
 */
export default function MediaStep({
  story,
  onChange,
  onContinue,
  onBack,
}) {
  const [tab, setTab] = useState("image");
  const [jobs, setJobs] = useState([]); // in-flight uploads
  const inputRef = useRef(null);

  const media = story.media || [];
  const shown = media.filter((m) => m.type === tab);
  const uploading = jobs.length > 0;

  function addJob(id, file) {
    setJobs((prev) => [
      ...prev,
      { id, name: file.name, progress: 0 },
    ]);
  }

  function setJobProgress(id, progress) {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, progress } : job)),
    );
  }

  function finishJob(id) {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const { mb } = LIMITS[tab];

    const accepted = [];
    for (const file of files) {
      if (file.size > mb * 1024 * 1024) {
        toast.error(`${file.name} is over ${mb} MB.`);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) return;

    const uploaded = [];
    let firstError = null;

    // Files go up one after another so each progress bar is readable.
    for (const file of accepted) {
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      addJob(jobId, file);

      try {
        const descriptor = await uploadViaPresign(file, tab, (progress) =>
          setJobProgress(jobId, progress),
        );
        uploaded.push(descriptor);
      } catch (err) {
        firstError = err;
      } finally {
        finishJob(jobId);
      }
    }

    if (uploaded.length > 0) {
      onChange({ ...story, media: [...media, ...uploaded] });
      toast.success(`${uploaded.length} file(s) added`);
    }
    if (firstError) {
      toast.error(
        firstError?.response?.data?.error?.message ||
          firstError.message ||
          "Failed to upload media",
      );
    }
  }

  function removeMedia(idx) {
    const item = media[idx];
    // Best-effort cleanup of the R2 object via the unified uploads route.
    if (item?.key) {
      api.delete("/uploads", { data: { key: item.key } }).catch(() => {});
    }
    onChange({ ...story, media: media.filter((_, i) => i !== idx) });
  }

  const activeTabJobs = jobs;

  return (
    <WizardShell step={4} totalSteps={5} onBack={onBack}>
      {/* Tabs */}
      <div className="mb-4 flex border-b border-border/60">
        {TABS.map((t) => {
          const count = media.filter((m) => m.type === t.key).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px flex-1 border-b-2 pb-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {count > 0 && ` (${count})`}
            </button>
          );
        })}
      </div>

      {/* Tile grid; each tile gets an optional caption input beneath it */}
      {shown.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-x-2.5 gap-y-3">
          {media.map((m, idx) =>
            m.type !== tab ? null : (
              <div key={idx} className="space-y-1.5">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                  {m.type === "image" ? (
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={m.url} className="h-full w-full object-cover" muted />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(idx)}
                    aria-label="Remove media"
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card"
                  >
                    <Icons.close className="h-3.5 w-3.5" />
                  </button>
                </div>

                {m.type === "image" && (
                  <input
                    type="text"
                    value={m.caption || ""}
                    onChange={(e) =>
                      onChange({
                        ...story,
                        media: media.map((item, i) =>
                          i === idx
                            ? { ...item, caption: e.target.value.slice(0, 300) }
                            : item,
                        ),
                      })
                    }
                    placeholder="Add a caption…"
                    className="w-full rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                )}
              </div>
            ),
          )}

          {/* Live progress tiles for uploads still in flight */}
          {activeTabJobs.map((job) => (
            <UploadTile key={job.id} job={job} />
          ))}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50"
          >
            {uploading ? (
              <Icons.spinner className="h-5 w-5 animate-spin" />
            ) : (
              <Icons.plus className="h-6 w-6" />
            )}
          </button>
        </div>
      )}

      {/* Empty state for the active tab */}
      {shown.length === 0 && (
        <div
          className="mb-4 grid grid-cols-3 gap-2.5"
        >
          {activeTabJobs.map((job) => (
            <UploadTile key={job.id} job={job} />
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50"
          >
            {uploading ? (
              <Icons.spinner className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Icons.plus className="h-7 w-7" />
                <span className="text-sm font-medium">
                  Add {LIMITS[tab].label.toLowerCase()}
                </span>
                <span className="text-xs">Up to {LIMITS[tab].mb} MB per file</span>
              </>
            )}
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[tab]}
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="mt-8">
        <button
          type="button"
          onClick={onContinue}
          disabled={uploading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3.5 font-display text-sm font-semibold shadow-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {media.length > 0 ? "Continue" : "Skip for now"}
          <Icons.chevronRight className="h-4 w-4" />
        </button>
      </div>
    </WizardShell>
  );
}
