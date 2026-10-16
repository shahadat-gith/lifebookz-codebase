import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import useMyStories from "../../hooks/useMyStories";
import * as storyApi from "../../utils/storyApi";
import { apiErrorMessage, storyEntryId } from "../../utils/helpers";
import ErrorBanner from "../../components/common/ErrorBanner";
import { Icons } from "../../icons";
import {
  dashboardTotals,
  flattenStories,
  recentLikers as collectLikers,
} from "./utils";

import DashboardStats from "./components/DashboardStats";
import RecentLikers from "./components/RecentLikers";
import StoryList from "./components/StoryList";

/**
 * My Stories — one place for everything the author has written.
 *
 * Stories are flat documents now; the tiles, the cards and the story list
 * are all derived from the same loaded data, so no two views of the
 * dashboard can disagree.
 */
export default function StoryDashboardPage() {
  const navigate = useNavigate();
  const { author } = useAuth();
  const authorId = author?.id || author?._id || null;

  const { stories, setStories, loading, error, reload } = useMyStories({
    enabled: Boolean(authorId),
  });

  const [removingId, setRemovingId] = useState(null);

  const rows = useMemo(() => flattenStories(stories), [stories]);
  const totals = useMemo(() => dashboardTotals(stories), [stories]);
  const likers = useMemo(() => collectLikers(stories), [stories]);

  const openEdit = (rowOrId) =>
    navigate(
      typeof rowOrId === "object"
        ? `/stories/${storyEntryId(rowOrId.story)}/edit`
        : `/stories/${rowOrId}/edit`,
    );

  const openStory = (row) =>
    row.story?.slug && navigate(`/feed/story/${row.story.slug}`);

  /** Remove one story — drafts and published alike. */
  async function handleRemove(row) {
    const title = row.story.title || "Untitled";
    if (!window.confirm(`Remove “${title}”? This cannot be undone.`)) return;

    const id = storyEntryId(row.story);
    const previous = stories;
    setRemovingId(row.id);

    // Drop it immediately so the tiles and lists move together.
    setStories((prev) => prev.filter((story) => storyEntryId(story) !== id));

    try {
      await storyApi.remove(id);
      toast.success("Story removed");
    } catch (err) {
      setStories(previous);
      toast.error(
        err?.response?.data?.error?.message || "Could not remove that story.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-12"
    >
      {/* ═══════════ Header ═══════════ */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            My Stories
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you have written, and what readers are doing with it.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/stories/new")}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110"
        >
          <Icons.plus className="h-4 w-4" />
          New story
        </button>
      </header>

      {/* ═══════════ Headline numbers ═══════════ */}
      <DashboardStats totals={totals} loading={loading} />

      {/* ═══════════ Load failure ═══════════ */}
      {error && (
        <ErrorBanner
          className="mt-4"
          error={error}
          message={apiErrorMessage(error, "We couldn't load your stories.")}
          onRetry={reload}
        />
      )}

      {/* ═══════════ Stories + activity ═══════════ */}
      {/* min-w-0 on both columns: grid items refuse to shrink below their
          content's intrinsic width otherwise, which overflows on phones. */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <StoryList
            rows={rows}
            loading={loading}
            removingId={removingId}
            onEdit={(row) => openEdit(row)}
            onView={(row) => row.story?.slug && openStory(row)}
            onRemove={handleRemove}
          />
        </div>

        <aside className="min-w-0">
          <RecentLikers likers={likers} />
        </aside>
      </div>
    </motion.div>
  );
}
