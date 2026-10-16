import { useState } from "react";
import { motion } from "framer-motion";
import { Icons } from "../../../icons";
import RichText from "../../../components/common/RichText";
import StoryTypeBadge from "../../../components/common/StoryTypeBadge";
import EmptyState from "../../../components/common/EmptyState";
import { VISIBILITY_OPTIONS, visibilityOption } from "../../../utils/visibility";

/**
 * Lifebook tab — the author's stories grouped by their chapter (a story's
 * own `chapterName` field).
 *
 * Chapters are not documents any more: there is no "add chapter" or rename,
 * nothing to create or delete separately. A group is simply the stories the
 * author tagged with the same phase of life, and the tab opens into that
 * group's reader.
 */
export default function StoryGroups({ chapterRows, onAddStory, onEditStory, onDeleteStory, onStoryVisibility, empty }) {
  const [openKey, setOpenKey] = useState(null);
  const openGroup = chapterRows.find((ch) => ch.keyName === openKey);

  if (openGroup) {
    return (
      <GroupReader
        group={openGroup}
        onBack={() => setOpenKey(null)}
        onEditStory={onEditStory}
        onDeleteStory={onDeleteStory}
        onChangeStoryVisibility={(storyId, vis) =>
          onStoryVisibility(null, null, storyId, vis)
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {chapterRows.length === 0 ? (
        <EmptyState
          variant="panel"
          icon={Icons.book}
          title="Your lifebook is empty"
          description="Stories hold the moments of your life. Write your first one."
          action={{
            label: "Write First Story",
            icon: Icons.plus,
            onClick: onAddStory,
          }}
        />
      ) : (
        <div className="space-y-3.5">
          {chapterRows.map((group) => (
            <motion.button
              key={group.keyName}
              type="button"
              whileTap={{ scale: 0.995 }}
              onClick={() => setOpenKey(group.keyName)}
              className={`flex w-full items-center gap-4 rounded-2xl border p-3 text-left shadow-xs transition-all hover:shadow-sm ${group.tint}`}
            >
              {group.cover ? (
                <img
                  src={group.cover}
                  alt=""
                  className="h-16 w-20 flex-shrink-0 rounded-xl object-cover sm:h-20 sm:w-24"
                />
              ) : (
                <div className="flex h-16 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-card/70 sm:h-20 sm:w-24">
                  <Icons.book className="h-6 w-6 text-muted-foreground/60" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display text-base font-bold text-foreground sm:text-lg">
                  {group.name}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-foreground/80">
                  {group.storyCount} {group.storyCount === 1 ? "Story" : "Stories"}
                </p>
              </div>

              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border/50 bg-card/80 font-display text-sm font-bold text-foreground">
                {group.storyCount}
              </span>
              <Icons.chevronRight className="h-4 w-4 flex-shrink-0 text-foreground/50" />
            </motion.button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAddStory}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-card p-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Icons.plus className="h-4 w-4" />
        Write New Story
      </button>
    </div>
  );
}

/* ───────────────── Group reader ───────────────── */

function GroupReader({ group, onBack, onEditStory, onDeleteStory, onChangeStoryVisibility }) {
  const stories = group.stories || [];
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function handleRemove(storyId) {
    setDeletingId(storyId);
    try {
      await onDeleteStory(null, null, storyId);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="group mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icons.chevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        All Chapters
      </button>

      <div className="mb-6 flex items-start gap-4">
        {group.cover ? (
          <img
            src={group.cover}
            alt=""
            className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <div
            className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border ${group.tint}`}
          >
            <Icons.book className="h-6 w-6 text-muted-foreground/60" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`font-display text-sm font-bold ${group.numColor}`}>
            Chapter
          </p>
          <h2 className="mt-0.5 font-display text-xl font-bold text-foreground sm:text-2xl">
            {group.name}
          </h2>
        </div>
      </div>

      {stories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Icons.document className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No stories in this chapter yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stories.map((s, i) => {
            const storyId = s._id || s.id;
            const confirming = confirmId === storyId;
            const deleting = deletingId === storyId;

            return (
              <article
                key={storyId || i}
                className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StoryTypeBadge type={s.storyType} />
                  {s.status === "published" ? (
                    <span className="text-[10px] font-semibold text-success">Published</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-warning">Draft</span>
                  )}
                </div>

                <h3 className="font-display text-lg font-bold text-foreground">
                  {s.title || "Untitled"}
                </h3>

                <RichText
                  content={s.content}
                  className="mt-2 text-sm leading-relaxed text-foreground/90"
                />

                <MediaGallery media={s.media} className="mt-4" heightClass="h-24" />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onEditStory(null, storyId)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-accent"
                    >
                      <Icons.edit className="h-3.5 w-3.5" />
                      Edit Story
                    </button>

                    <StoryVisibility
                      value={s.visibility || "public"}
                      onChange={(next) => onChangeStoryVisibility(storyId, next)}
                    />
                  </div>

                  {confirming ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-destructive">
                        Remove this story?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(storyId)}
                        disabled={deleting}
                        className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {deleting ? (
                          <Icons.spinner className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icons.trash className="h-3.5 w-3.5" />
                        )}
                        {deleting ? "Removing…" : "Yes, remove"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        disabled={deleting}
                        className="rounded-full border border-border/70 px-3.5 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                      >
                        Keep it
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(storyId)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive/80 transition-colors hover:text-destructive"
                      title="Remove this story"
                    >
                      <Icons.trash className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Who can read one story. Visibility is a story's own setting.
 */
function StoryVisibility({ value, onChange }) {
  const [open, setOpen] = useState(false);

  const current = visibilityOption(value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Change who can see this story"
        aria-label="Change who can see this story"
        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition-colors hover:bg-muted"
      >
        <current.icon className="h-3.5 w-3.5 text-primary" />
        <span>{current.shortLabel}</span>
        <Icons.chevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <>
          {/* Close on outside click */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full z-20 mt-2 w-48 rounded-xl border border-border/80 bg-popover p-1.5 shadow-md">
            <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Who can see this story
            </p>
            {VISIBILITY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = opt.value === current.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!active) onChange(opt.value);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-primary/5 font-semibold text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {opt.label}
                  {active && <Icons.check className="ml-auto h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Story media. One photo or video spans the full width; several fall back
 * to a compact grid.
 */
function MediaGallery({ media, className = "", heightClass = "h-28" }) {
  const items = media || [];
  if (items.length === 0) return null;

  const [only] = items;
  if (items.length === 1) {
    return only.type === "video" ? (
      <video
        src={only.url}
        controls
        className={`w-full max-h-[26rem] rounded-xl bg-black ${className}`}
      />
    ) : (
      <img
        src={only.url}
        alt={only.caption || "Story media"}
        className={`w-full max-h-[26rem] rounded-xl object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-2 sm:grid-cols-4 ${className}`}>
      {items.map((m, i) =>
        m.type === "video" ? (
          <video
            key={i}
            src={m.url}
            controls
            className={`w-full ${heightClass} rounded-xl bg-black object-cover`}
          />
        ) : (
          <img
            key={i}
            src={m.url}
            alt={m.caption || "Story media"}
            className={`w-full ${heightClass} rounded-xl object-cover`}
          />
        ),
      )}
    </div>
  );
}
