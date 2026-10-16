import { motion } from "framer-motion";
import { Icons } from "../../../icons";
import toast from "react-hot-toast";

/**
 * The confirmation after a story publishes: success burst, share-and-write
 * actions, back to the profile. Deliberately light — the story itself is
 * already live in the feed.
 */
export default function PublishedStep({ storyUrl, onAddAnother, onGoHome }) {
  function handleShare() {
    const full = storyUrl ? `${window.location.origin}${storyUrl}` : window.location.href;
    if (navigator.share) {
      navigator.share({ title: "My Lifebook Story", url: full }).catch(() => {});
    } else {
      navigator.clipboard.writeText(full);
      toast.success("Link copied to clipboard");
    }
  }

  const NEXT_ACTIONS = [
    { label: "Share your story", icon: <Icons.share className="h-4 w-4" />, onClick: handleShare },
    { label: "Write another story", icon: <Icons.plus className="h-4 w-4" />, onClick: onAddAnother },
    { label: "Go to my stories", icon: <Icons.book className="h-4 w-4" />, onClick: onGoHome },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto w-full max-w-xl rounded-3xl border border-border/60 bg-card p-5 shadow-md sm:p-8"
      >
        <div className="flex flex-col items-center py-6">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="relative"
          >
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-success shadow-lg shadow-success/30">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-12 w-12 text-white"
                stroke="currentColor"
                strokeWidth={3}
              >
                <motion.path
                  d="M5 13l4 4L19 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                />
              </svg>
            </span>

            {[
              "top-0 left-0 text-accent",
              "top-2 right-0 text-warning",
              "bottom-0 right-2 text-info",
              "bottom-1 left-1 text-accent",
            ].map((pos, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0.6], scale: 1 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className={`absolute ${pos}`}
              >
                <Icons.sparkles className="h-3.5 w-3.5" />
              </motion.span>
            ))}
          </motion.div>

          <h2 className="mt-6 font-display text-2xl font-bold text-foreground">
            Your story is live!
          </h2>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            It's in the feed now — readers will
            <br />
            see it under your name.
          </p>
        </div>

        <p className="mb-2 text-sm font-bold text-foreground">What's next?</p>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs divide-y divide-border/50">
          {NEXT_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
            >
              <span className="text-muted-foreground">{a.icon}</span>
              <span className="flex-1 text-sm font-medium text-foreground">{a.label}</span>
              <Icons.chevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onGoHome}
          className="mt-8 flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3.5 font-display text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110"
        >
          View My Stories
        </button>
      </motion.div>
    </div>
  );
}
