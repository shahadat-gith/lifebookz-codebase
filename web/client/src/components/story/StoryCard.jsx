import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Avatar from "../ui/Avatar";
import { Icons } from "../../icons";
import { getTimeAgo, formatLikesCaption } from "../../utils/helpers";
import { isVerifiedAuthor } from "../../utils/authors";
import api from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { share } from "../../utils/share";

const TYPE_LABELS = {
  memory: "Memory",
  life_lesson: "Career",
  achievement: "Achievement",
  advice: "Advice",
  experience: "Experience",
  disease: "Health",
  failure: "Failure",
  other: "Other",
};

/**
 * One story in the feed — a flat document now, rendered as a magazine
 * card: the banner as the cover with the type chip laid over it, the
 * author row, the title, then the action strip.
 */
export default function StoryCard({ story, showActions = true }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [liked, setLiked] = useState(story.likedByUser || false);
  const [likeCount, setLikeCount] = useState(story.stats?.likes || 0);

  const author = story.author || {};
  const authorName = author.fullName || "Anonymous Author";
  const isVerified = isVerifiedAuthor(author);
  const timeAgo = getTimeAgo(new Date(story.publishedAt || story.createdAt));
  const storyTitle = story.title || "Untitled Story";
  const storySlug = story.slug || story._id;
  const typeLabel = TYPE_LABELS[story.storyType] || story.storyType;

  async function handleLike(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast("Sign in to like stories");
      navigate("/login");
      return;
    }
    const next = !liked;

    setLiked(next);
    setLikeCount((c) => (next ? c + 1 : c - 1));

    try {
      const res = await api.post(`/stories/${story._id}/like`);
      if (res.data?.data?.liked !== undefined && res.data.data.liked !== next) {
        setLiked(res.data.data.liked);
        setLikeCount((c) => (res.data.data.liked ? c + 1 : c - 1));
      }
    } catch {
      setLiked(liked);
      setLikeCount((c) => (liked ? c + 1 : c - 1));
      toast.error("Failed to update like");
    }
  }

  async function handleShare(e) {
    e.preventDefault();
    e.stopPropagation();

    const shared = await share({
      title: storyTitle,
      text: `📖 ${storyTitle}\n\nRead this story on Lifebookz.`,
      url: `/feed/story/${storySlug}`,
    });

    if (shared) {
      toast.success("Shared successfully!");
    } else {
      toast.success("Link copied to clipboard");
    }
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition-all duration-200 hover:border-border hover:shadow-sm">
      {/* Banner with the type chip laid over it */}
      <Link to={`/feed/story/${storySlug}`} className="block">
        <div className="relative">
          <div className="h-52 w-full overflow-hidden bg-muted sm:h-60">
            {story.bannerImage?.url ? (
              <img
                src={story.bannerImage.url}
                alt={storyTitle}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                <Icons.book className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {typeLabel && (
            <span className="absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground shadow-sm backdrop-blur">
              {typeLabel}
            </span>
          )}
          {story.chapterName && (
            <span className="absolute left-3 top-10 rounded-full bg-primary/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow-sm backdrop-blur">
              {story.chapterName}
            </span>
          )}
        </div>
      </Link>

      {/* Author row */}
      <div className="px-5 pb-3 pt-4">
        <Link
          to={`/authors/${author._id}`}
          className="group/author flex min-w-0 items-center gap-3"
        >
          <Avatar
            src={author.avatar?.url}
            name={authorName}
            size="md"
            className="shrink-0 ring-1 ring-border/60 transition-opacity group-hover/author:opacity-80"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-sm font-semibold tracking-tight text-foreground group-hover/author:underline">
              <span className="truncate">{authorName}</span>
              {isVerified && (
                <Icons.verified
                  aria-label="Verified author"
                  title="Verified author"
                  className="h-4 w-4 shrink-0 text-blue-500"
                />
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[author.profession, timeAgo].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Icons.chevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover/author:translate-x-0.5" />
        </Link>
      </div>

      {/* Title */}
      <Link to={`/feed/story/${storySlug}`} className="block px-5">
        <h2 className="font-display text-lg font-bold leading-snug tracking-tight text-foreground transition-all hover:underline">
          {storyTitle}
        </h2>
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
          Read story
          <Icons.chevronRight className="h-3 w-3" />
        </span>
      </Link>

      {/* Action row */}
      {showActions && (
        <div className="mt-4 flex items-center gap-6 border-t border-border/60 px-5 py-3.5">
          <button
            type="button"
            onClick={handleLike}
            aria-pressed={liked}
            aria-label={liked ? "Unlike this story" : "Like this story"}
            className={`flex select-none items-center gap-1.5 text-xs font-semibold transition-colors ${
              liked ? "text-destructive" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {liked ? (
              <Icons.heartSolid className="h-4 w-4" />
            ) : (
              <Icons.heartRegular className="h-4 w-4" />
            )}
            <span>{likeCount}</span>
          </button>

          <Link
            to={`/feed/story/${storySlug}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icons.chat className="h-4 w-4" />
            <span>{story.stats?.comments || 0}</span>
          </Link>

          <button
            type="button"
            onClick={handleShare}
            aria-label="Share this story"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icons.share className="h-4 w-4" />
            <span>{story.stats?.shares || 0}</span>
          </button>

          {/* Like caption pushed to the right */}
          <span className="ml-auto truncate text-xs text-muted-foreground">
            {formatLikesCaption(story.recentLikers, likeCount)}
          </span>
        </div>
      )}
    </article>
  );
}
