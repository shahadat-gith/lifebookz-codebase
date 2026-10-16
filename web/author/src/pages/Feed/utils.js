import { STORY_TYPE_OPTIONS } from "../../utils/storyTypes";

/** Who the feed can be narrowed to, by the author's own gender. */
export const GENDER_OPTIONS = [
  { value: "", label: "Any gender" },
  { value: "Male", label: "Male authors" },
  { value: "Female", label: "Female authors" },
  { value: "Other", label: "Other" },
];

/** How many stories one page of the feed holds. */
export const PAGE_SIZE = 10;

/**
 * The circular type-filter options: every story type the writing flow
 * offers (utils/storyTypes), plus All — one source of truth for both.
 */
export const FEED_TYPE_OPTIONS = [
  { value: "", label: "All" },
  ...STORY_TYPE_OPTIONS.map(({ value, label }) => ({ value, label })),
];

export const EMPTY_FILTERS = {
  authorName: "",
  profession: "",
  gender: "",
  storyType: "",
};

/**
 * The filters as `/stories` expects them.
 *
 * Unset filters are left out entirely so the request URL stays readable and
 * the API keeps its defaults.
 */
export function feedQuery({ profession, authorName, gender, storyType }) {
  const params = {};
  if (profession) params.profession = profession;
  if (authorName) params.authorName = authorName;
  if (gender) params.gender = gender;
  if (storyType) params.storyType = storyType;
  return params;
}

/**
 * How many filters are narrowing the feed right now.
 *
 * Doubles as the badge count on the filter icon and as the "is anything
 * applied" test, so the two can never disagree.
 */
export function activeFilterCount(filters = {}) {
  return [filters.profession, filters.authorName, filters.gender, filters.storyType]
    .filter(Boolean).length;
}
