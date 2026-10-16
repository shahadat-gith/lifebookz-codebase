import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { Icons } from "../../icons";
import ErrorBanner from "../../components/common/ErrorBanner";
import EmptyState from "../../components/common/EmptyState";

import ProfileHeader from "./components/ProfileHeader";
import StoryTypeBadge from "../../components/common/StoryTypeBadge";
import { apiErrorMessage } from "../../utils/helpers";
import * as storyApi from "../../utils/storyApi";

/**
 * The author's own profile: their identity only.
 *
 * Story management lives on the dedicated My Stories page, so this screen
 * shows the header, the publish-readiness prompt and a small preview of the
 * most recent stories with a link through.
 */
export default function ProfilePage() {
  const { author } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useMyRedirect(searchParams, navigate);

  // A light recent-stories preview from the My Stories endpoint.
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function reload() {
    if (!author) return;
    setLoading(true);
    setError(null);
    try {
      const data = await storyApi.getMyStories();
      setRecent((data.stories || []).slice(0, 4));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author?.id || author?._id]);

  if (!author) return <Navigate to="/login" replace />;

  function handleShare() {
    const url = `${window.location.origin}/authors/${author.id || author._id}`;
    if (navigator.share) {
      navigator.share({ title: author.fullName, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="pb-24 md:pb-10"
    >
      <ProfileHeader
        author={author}
        bio={author.bio}
        onShare={handleShare}
        onEdit={() => navigate("/profile/edit")}
      />

      {/* Prompt for non-upgraded accounts: publish lives behind isAuthor */}
      {!author.isAuthor && (
        <div className="mx-auto mt-4 max-w-4xl px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/profile/edit?complete=1")}
            className="flex w-full items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-left transition-colors hover:bg-warning/15"
          >
            <Icons.infoCircle className="h-4 w-4 flex-shrink-0 text-warning" />
            <span className="flex-1 text-sm text-foreground">
              Complete your profile to publish stories.
            </span>
            <Icons.chevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {error && (
        <div className="mx-auto mt-4 max-w-4xl px-4 sm:px-6">
          <ErrorBanner
            error={error}
            message={apiErrorMessage(
              error,
              "We couldn't load your stories. Please try again.",
            )}
            onRetry={reload}
          />
        </div>
      )}

      <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6">
        {/* My Stories preview card */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate("/my-stories")}
              className="group inline-flex min-w-0 items-center gap-2 text-foreground"
            >
              <Icons.book className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="truncate font-display text-lg font-bold">
                My Stories
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/stories/new")}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:brightness-110"
            >
              <Icons.plus className="h-3.5 w-3.5" />
              New story
            </button>
          </div>

          {loading ? (
            <div className="mt-4 space-y-2.5" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl border border-border/50 bg-muted/40"
                />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              variant="panel"
              icon={Icons.document}
              title="No stories yet"
              description="Write your first story from the + button."
            />
          ) : (
            <>
              <div className="mt-4 space-y-2.5">
                {recent.map((story) => {
                  const id = story.id || story._id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => navigate(`/stories/${id}/edit`)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-background px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      {story.bannerImage?.url ? (
                        <img
                          src={story.bannerImage.url}
                          alt=""
                          className="h-11 w-16 flex-shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icons.book className="h-4 w-4 text-muted-foreground/60" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StoryTypeBadge type={story.storyType} />
                          {story.status === "published" ? (
                            <span className="text-[10px] font-semibold text-success">
                              Published
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-warning">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                          {story.title || "Untitled"}
                        </p>
                      </div>

                      <Icons.chevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => navigate("/my-stories")}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                View all my stories
                <Icons.chevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * ?complete=1&redirect=<path> → profile editing lives on its own page,
 * which also handles the "come back and publish" return trip. Sharing the
 * helper keeps that deep-link working when a redirect lands here.
 */
function useMyRedirect(searchParams, navigate) {
  const redirect = searchParams.get("redirect");

  useEffect(() => {
    if (!searchParams.get("complete")) return;

    navigate(
      `/profile/edit?complete=1${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ""}`,
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}

// Stats and story tabs moved to My Stories (see pages/StoryDashboard).
