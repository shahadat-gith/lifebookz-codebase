import { motion } from "framer-motion";
import { Icons } from "../../../icons";
import { WizardShell } from "./WizardShell";
import { STORY_TYPE_OPTIONS } from "../../../utils/storyTypes";
import { CHAPTER_OPTIONS } from "../../../utils/chapterNames";

/**
 * Step 1 — the story's classification. The chapter (a named phase of life)
 * and the story type are both selects; the feed filters run on exactly
 * these two fields, so they must be picked before anything else.
 */
export default function MetadataStep({
  story,
  onChange,
  onContinue,
  onBack,
}) {
  const canContinue = Boolean(story.chapterName && story.storyType);

  return (
    <WizardShell step={1} totalSteps={5} onBack={onBack}>
      <div className="space-y-6">
        {/* Chapter */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Icons.book className="h-4 w-4 text-muted-foreground" />
            Which chapter of life is this?
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CHAPTER_OPTIONS.map((chapter) => {
              const selected = story.chapterName === chapter;
              return (
                <motion.button
                  key={chapter}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onChange({ ...story, chapterName: chapter })}
                  className={`rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition-all ${
                    selected
                      ? "border-accent bg-accent/10 text-accent shadow-xs"
                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {chapter}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Story type */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Icons.tag className="h-4 w-4 text-muted-foreground" />
            What kind of story is it?
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STORY_TYPE_OPTIONS.map((type) => {
              const Icon = type.icon;
              const selected = story.storyType === type.value;
              return (
                <motion.button
                  key={type.value}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onChange({ ...story, storyType: type.value })}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                    selected
                      ? "border-accent bg-accent/5 shadow-xs ring-1 ring-accent/30"
                      : "border-border/70 bg-card hover:border-border"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${type.color}`} />
                  <span className="text-xs font-semibold text-foreground">{type.label}</span>
                </motion.button>
              );
            })}
          </div>
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
            Pick a chapter and a story type to continue.
          </p>
        )}
      </div>
    </WizardShell>
  );
}
