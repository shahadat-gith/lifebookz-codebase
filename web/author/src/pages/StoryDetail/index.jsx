import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";

import api from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { Icons } from "../../icons";
import { isVerifiedAuthor } from "../../utils/authors";

import RichText from "../../components/common/RichText";
import StoryActions from "./components/StoryActions";
import CommentSection from "./components/CommentSection";
import StorySkeleton from "./components/StorySkeleton";
import StoryMissing from "./components/StoryMissing";

/**
 * A story, read top to bottom — one flat document now: banner, title,
 * author, meta, media, content, then the actions and the comments.
 */
export default function StoryDetailPage() {
  const { slug } = useParams();
  const { author: viewer } = useAuth();

  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentTrigger, setCommentTrigger] = useState(0);
  const commentSectionRef = useRef(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError("");

    api
      .get(`/stories/${slug}`)
      .then((res) => setStory(res.data.data))
      .catch((err) => {
        setError(err.response?.data?.error?.message || "Story not found");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  function scrollToComments() {
    setCommentTrigger((count) => count + 1);
    setTimeout(() => {
      commentSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  if (loading) return <StorySkeleton />;
  if (error || !story) return <StoryMissing message={error} />;

  const author = story.author || {};
  const viewerId = viewer?.id || viewer?._id;
  const isOwnStory = Boolean(
    viewerId && author._id && String(viewerId) === String(author._id),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-5xl px-4 py-8 sm:px-6"
    >
      {/* Back to feed */}
      <Link
        to="/feed"
        className="group inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icons.chevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Feed
      </Link>

      {/* The banner stays on cards only — the reader starts at the title. */}

      {/* Title of the story, with its author right underneath */}
      <h1 className="mt-5 font-display text-3xl font-extrabold leading-[1.15] tracking-tight text-primary sm:text-4xl">
        {story.title || "Untitled Story"}
      </h1>
      <div className="mt-3 h-1 w-14 rounded-full bg-accent" aria-hidden="true" />

      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <span>By</span>
        <Link
          to={`/authors/${author._id}`}
          className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary hover:underline"
        >
          {author.fullName || "Anonymous"}
          {isVerifiedAuthor(author) && (
            <Icons.verified
              aria-label="Verified author"
              className="h-4 w-4 shrink-0 text-info"
            />
          )}
        </Link>
      </p>

      {/* Meta: when / where + type + chapter */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {story.dateLabel && (
          <span className="inline-flex items-center gap-1">
            <Icons.clock className="h-3.5 w-3.5" />
            {story.dateLabel}
          </span>
        )}
        {story.location && (
          <span className="inline-flex items-center gap-1">
            <Icons.globe className="h-3.5 w-3.5" />
            {story.location}
          </span>
        )}
        {story.storyType && (
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
            {story.storyType.replace(/_/g, " ")}
          </span>
        )}
        {story.chapterName && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {story.chapterName}
          </span>
        )}
      </div>

      {/* Media — the story's own pictures with their captions, if any */}
      {(story.media || []).length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {story.media.map((m, i) => (
            <div key={i}>
              {m.type === "video" ? (
                <video src={m.url} controls className="w-full rounded-xl bg-black" />
              ) : (
                <img
                  src={m.url}
                  alt={m.caption || "Story media"}
                  loading="lazy"
                  className="w-full rounded-xl object-cover"
                />
              )}
              {m.caption && (
                <p className="mt-1 text-xs italic text-muted-foreground">
                  {m.caption}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* The story itself — rich text rendered, never raw HTML tags */}
      <RichText
        content={story.content}
        className="mt-6 text-[15px] leading-relaxed text-foreground/90"
      />

      {/* Like · Comment · Share — the same actions readers get */}
      <StoryActions story={story} onComment={scrollToComments} />

      {/* Comments */}
      <div ref={commentSectionRef} className="mt-8 border-t border-border/40 pt-6">
        <h3 className="mb-4 font-display text-lg font-bold text-foreground">Comments</h3>
        <CommentSection
          storyId={story._id}
          commentTrigger={commentTrigger}
          canReply={isOwnStory}
        />
      </div>
    </motion.div>
  );
}
