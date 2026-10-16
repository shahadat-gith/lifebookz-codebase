/**
 * The story kinds the feed's circular filter chips offer — mirrors the
 * backend's STORY_TYPES enum (models/Story.js) so a selected chip can never
 * send a value the API rejects.
 */

/** Who the feed can be narrowed to, by the author's own gender. */
export const GENDER_OPTIONS = [
  { value: "", label: "Any gender" },
  { value: "Male", label: "Male authors" },
  { value: "Female", label: "Female authors" },
  { value: "Other", label: "Other" },
];

export const STORY_TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "memory", label: "Memory" },
  { value: "life_lesson", label: "Life Lesson" },
  { value: "achievement", label: "Achievement" },
  { value: "advice", label: "Advice" },
  { value: "experience", label: "Experience" },
  { value: "disease", label: "Disease" },
  { value: "failure", label: "Failure" },
  { value: "other", label: "Other" },
];

export const EMPTY_FILTERS = {
  authorName: "",
  profession: "",
  gender: "",
  storyType: "",
};

/**
 * How many filters are narrowing the feed right now.
 *
 * Doubles as the badge count on the filter icon and as the "is anything
 * applied" test, so the two can never disagree.
 */
export function activeFilterCount(filters: Partial<FeedFilters> = {}) {
  return [
    filters.profession,
    filters.authorName,
    filters.gender,
    filters.storyType,
  ].filter(Boolean).length;
}

/**
 * The filters as `/stories` expects them.
 *
 * Unset filters are left out entirely so the request URL stays readable and
 * the API keeps its defaults.
 */
export function feedQuery(filters: Partial<FeedFilters> = {}) {
  const params: Record<string, string> = {};

  if (filters.profession) params.profession = filters.profession;
  if (filters.authorName) params.authorName = filters.authorName;
  if (filters.gender) params.gender = filters.gender;
  if (filters.storyType) params.storyType = filters.storyType;

  return params;
}

export interface FeedFilters {
  authorName: string;
  profession: string;
  gender: string;
  storyType: string;
}
