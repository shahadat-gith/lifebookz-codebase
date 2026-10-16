import { Icons } from "../../../icons";
import { WizardShell } from "./WizardShell";

const OPTIONS = [
  {
    value: "public",
    label: "Everyone (Public)",
    description: "Anyone on Lifebookz can read this story in the feed.",
    icon: Icons.globe,
  },
  {
    value: "followers",
    label: "Followers",
    description: "Only people who follow you can read it.",
    icon: Icons.user,
  },
  {
    value: "private",
    label: "Only Me (Private)",
    description: "Just you — publish later once you're ready.",
    icon: Icons.lock,
  },
];

/**
 * Step 4 — who can read this story, and final publish. The one mandatory
 * gate is re-checked here: a story without a banner stays unpublished.
 */
export default function VisibilityStep({
  visibility,
  onChange,
  onPublish,
  onBack,
  hasBanner,
  publishing,
}) {
  const canPublish = Boolean(hasBanner) && !publishing;

  return (
    <WizardShell step={5} totalSteps={5} onBack={onBack}>
      <div className="space-y-3">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = visibility === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${
                selected
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                  : "border-border/70 bg-card shadow-xs hover:border-border"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="mt-1 accent-[#172554]"
              />
              <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-bold text-foreground">{opt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Reassurance */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10">
          <Icons.shieldCheck className="h-4 w-4 text-accent" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">You can change this later</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            You'll always have full control over your story.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 font-display text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {publishing ? (
            <>
              <Icons.spinner className="h-4 w-4 animate-spin" />
              Publishing…
            </>
          ) : (
            <>
              <Icons.shieldCheck className="h-4 w-4" />
              Publish Story
            </>
          )}
        </button>
        {!hasBanner && (
          <p className="mt-2 text-center text-xs text-destructive">
            A banner is required before publishing — go back and add one.
          </p>
        )}
      </div>
    </WizardShell>
  );
}
