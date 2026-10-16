import { Icons } from "../icons";

/**
 * The kinds of story an author can write — one list, matching the backend's
 * STORY_TYPES enum exactly (models/Story.js). Three screens read it: the
 * writing wizard offers every type, the badges colour-code it, and the
 * dashboard labels it. They must never disagree about what a "memory" is
 * called or what colour it wears.
 *
 * - `color` tints the type tile in the wizard
 * - `tint`  is the pastel badge used in lists and readers
 */
export const STORY_TYPE_OPTIONS = [
  {
    value: "memory",
    label: "Memory",
    hint: "A moment I want to remember",
    color: "text-success",
    tint: "bg-rose-500/10 text-rose-600",
    icon: Icons.heartRegular,
  },
  {
    value: "life_lesson",
    label: "Life Lesson",
    hint: "Something I learned",
    color: "text-accent",
    tint: "bg-emerald-500/10 text-success",
    icon: Icons.book,
  },
  {
    value: "achievement",
    label: "Achievement",
    hint: "Something I'm proud of",
    color: "text-warning",
    tint: "bg-amber-400/15 text-warning",
    icon: Icons.starSolid,
  },
  {
    value: "advice",
    label: "Advice",
    hint: "Guidance I'd give my younger self",
    color: "text-info",
    tint: "bg-sky-500/10 text-info",
    icon: Icons.sparkles,
  },
  {
    value: "experience",
    label: "Experience",
    hint: "Something I lived through",
    color: "text-info",
    tint: "bg-blue-500/10 text-info",
    icon: Icons.globe,
  },
  {
    value: "disease",
    label: "Disease",
    hint: "An illness I faced",
    color: "text-cyan-600",
    tint: "bg-cyan-500/10 text-cyan-600",
    icon: Icons.heartbeat,
  },
  {
    value: "failure",
    label: "Failure",
    hint: "Something I failed at",
    color: "text-orange-600",
    tint: "bg-orange-500/10 text-orange-600",
    icon: Icons.exclamationTriangle,
  },
  {
    value: "other",
    label: "Other",
    hint: "Something else important",
    color: "text-primary",
    tint: "bg-muted text-muted-foreground",
    icon: Icons.tag,
  },
];

export const STORY_TYPES = STORY_TYPE_OPTIONS;

export const STORY_TYPE_OTHER = STORY_TYPE_OPTIONS[STORY_TYPE_OPTIONS.length - 1];

/** The type for a stored value, falling back to "Other". */
export function storyType(value) {
  return STORY_TYPE_OPTIONS.find((t) => t.value === value) || STORY_TYPE_OTHER;
}
