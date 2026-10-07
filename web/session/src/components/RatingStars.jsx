import { useState } from "react";

import { Icon, Paths } from "./Icons";

const PROMPTS = {
  1: "Not helpful at all",
  2: "Below expectations",
  3: "It was okay",
  4: "Really helpful",
  5: "Excellent session",
};

/** Interactive 1–5 star picker with an encouraging label per step. */
export default function RatingStars({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rate this session">
        {[1, 2, 3, 4, 5].map((step) => (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={value === step}
            aria-label={`${step} star${step > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(step)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(step)}
            className={`transition-transform active:scale-90 ${
              step <= active ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40"
            }`}
          >
            <Icon path={Paths.star} className="h-9 w-9" />
          </button>
        ))}
      </div>
      {active > 0 && (
        <p className="text-xs font-bold text-foreground">{PROMPTS[active]}</p>
      )}
    </div>
  );
}
