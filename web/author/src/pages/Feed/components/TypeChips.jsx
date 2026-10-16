import { FEED_TYPE_OPTIONS } from "../utils";

/**
 * Instagram-story style type filters on top of the feed — the exact same
 * options as the writing flow's story-type step, plus All.
 *
 * Circular tiles with the "ring" treatment stories rails use, a glyph of
 * the first letters of the label, and the name beneath. Chips commit
 * immediately: one tap, one fresh feed.
 */
export default function TypeChips({ value, onChange }) {
  return (
    <div className="no-scrollbar -mx-4 mb-6 flex items-end gap-4 overflow-x-auto px-4 pb-2 pt-2 sm:mx-0 sm:px-0">
      {FEED_TYPE_OPTIONS.map((option) => {
        const active = value === option.value;
        const isAll = option.value === "";

        return (
          <button
            key={option.value || "all"}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className="flex shrink-0 flex-col items-center gap-1.5 outline-none"
          >
            {/* Story ring */}
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full p-[3px] transition-all ${
                active
                  ? "bg-gradient-to-tr from-accent to-primary"
                  : "bg-gradient-to-tr from-border/60 to-border/30"
              }`}
            >
              <span className="flex h-full w-full items-center justify-center rounded-full border-2 border-card bg-card">
                <span
                  className={`text-xs font-extrabold tracking-wide ${
                    active ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  {isAll ? "ALL" : option.label.slice(0, 2).toUpperCase()}
                </span>
              </span>
            </span>

            <span
              className={`max-w-[64px] truncate text-[11px] font-semibold ${
                active ? "text-accent" : "text-muted-foreground"
              }`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
