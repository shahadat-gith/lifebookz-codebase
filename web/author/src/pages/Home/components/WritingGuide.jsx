import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Icons } from "../../../icons";

const STEPS_GUIDE = [
  {
    label: "Select Chapter",
    hint: "Pick the chapter of your life this story belongs to — childhood, school, career…",
    icon: Icons.book,
    tone: "bg-indigo-100 text-indigo-600",
  },
  {
    label: "Choose Story Type",
    hint: "Is it a memory, a life lesson, an achievement, or advice?",
    icon: Icons.tag,
    tone: "bg-amber-100 text-amber-600",
  },
  {
    label: "Story Details",
    hint: "Give it a title and tell us when and where it happened.",
    icon: Icons.edit,
    tone: "bg-sky-100 text-sky-600",
  },
  {
    label: "Write Your Story",
    hint: "The heart of it — write it the way you'd tell a friend.",
    icon: Icons.document,
    tone: "bg-emerald-100 text-emerald-600",
  },
  {
    label: "Add Media",
    hint: "Attach photos and videos to bring the story alive.",
    icon: Icons.camera,
    tone: "bg-violet-100 text-violet-600",
  },
  {
    label: "Choose Visibility",
    hint: "Public, or just you — chapter by chapter.",
    icon: Icons.shieldCheck,
    tone: "bg-teal-100 text-teal-600",
  },
  {
    label: "Preview & Publish",
    hint: "See it exactly as readers will, then share it with the world.",
    icon: Icons.globe,
    tone: "bg-rose-100 text-rose-600",
  },
];

/** Always-visible "how to write your story" guide. */
export default function WritingGuide({ onStart }) {
  const navigate = useNavigate();
  const startStory = onStart || (() => navigate("/stories/new"));

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="mb-10 rounded-3xl bg-gradient-to-br from-indigo-50 via-blue-50 to-white border border-blue-100 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-7 pb-6 sm:px-8 sm:pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
          Your story matters
        </p>
        <h3 className="mt-2.5 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-primary leading-tight">
          How to write your story
        </h3>
        <p className="mt-2.5 max-w-xl text-sm sm:text-base text-muted-foreground">
          From a blank page to a published story — here is how the flow works,
          step 1 through step 7.
        </p>
        <button
          type="button"
          onClick={startStory}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-display text-sm font-semibold shadow-sm hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <Icons.plus className="h-4 w-4" />
          Write Now
        </button>
      </div>

      {/* Steps — numbered 1 through 7, same rail pattern as the client's
          "How does Lifebookz work?" section */}
      <ol className="grid gap-3 px-5 pb-6 sm:px-8 sm:pb-8 sm:grid-cols-2">
        {STEPS_GUIDE.map((s, idx) => {
          const Icon = s.icon;
          return (
            <li key={s.label}>
              <div className="h-full flex overflow-hidden rounded-2xl bg-white/80 border border-border/50 shadow-xs">
                {/* Number rail */}
                <div className="flex w-12 shrink-0 flex-col items-center border-r border-border/50 bg-gradient-to-b from-primary/[0.06] to-transparent pt-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/25 bg-primary/5 font-display text-xs font-extrabold text-primary">
                    {idx + 1}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${s.tone}`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.hint}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </motion.section>
  );
}
