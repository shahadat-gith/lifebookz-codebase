import { Icons } from "../../icons";

/** The profile's tabs, in the order they are shown. */
export const PROFILE_TABS = [
  { key: "lifebook", label: "Lifebook", icon: Icons.book },
  { key: "stories", label: "Stories", icon: Icons.document },
  { key: "likes", label: "Likes", icon: Icons.heartRegular },
  { key: "activity", label: "Activity", icon: Icons.sparkles },
];

/** Pastel tint per chapter slot (matches the mockup's coloured cards). */
const CHAPTER_TINTS = [
  "bg-blue-50/70 border-blue-100",
  "bg-emerald-50/70 border-emerald-100",
  "bg-rose-50/70 border-rose-100",
  "bg-amber-50/70 border-amber-100",
  "bg-violet-50/70 border-violet-100",
  "bg-cyan-50/70 border-cyan-100",
];

const CHAPTER_NUM_COLORS = [
  "text-info",
  "text-success",
  "text-destructive",
  "text-warning",
  "text-accent",
  "text-info",
];

/**
 * One row per chapter (a story's `chapterName`), with everything the chapter
 * cards and the stories/memories tabs need already resolved.
 *
 * The rows come from the stories the tabs render, so the counters can never
 * disagree with the lists below them.
 */
export function chapterRows(stories = []) {
  const groups = new Map();

  for (const story of stories) {
    // The story's banner first — it's the mandatory cover. Fallback to the
    // story's own gallery for anything uploaded before the banner existed.
    const name = story.chapterName || "Uncategorized";
    const key = name;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(story);
  }

  return [...groups.entries()].map(([name, group], index) => {
    const cover = group.find((s) => s.bannerImage?.url)?.bannerImage?.url;

    return {
      // Synthetic chapter: a named group of flat stories.
      keyName: name,
      name,
      label: name,
      hint: "",
      order: index,
      number: index + 1,
      storyCount: group.length,
      tint: CHAPTER_TINTS[index % CHAPTER_TINTS.length],
      numColor: CHAPTER_NUM_COLORS[index % CHAPTER_NUM_COLORS.length],
      cover: cover || null,
      stories: group,
    };
  });
}

/**
 * The headline numbers under the profile header.
 *
 * `stats` is null until the engagement counts arrive, so it is normalized
 * here rather than guarded at every use.
 */
export function profileStats(rows = [], stats = null) {
  return [
    { value: rows.length, label: "Chapters" },
    {
      value: rows.reduce((sum, row) => sum + (row.storyCount || 0), 0),
      label: "Stories",
    },
    { value: stats?.likes || 0, label: "Likes" },
  ];
}
