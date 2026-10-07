/** Who the feed can be narrowed to, by the author's own gender. */
export const GENDER_OPTIONS = [
  { value: "", label: "Any gender" },
  { value: "Male", label: "Male authors" },
  { value: "Female", label: "Female authors" },
  { value: "Other", label: "Other" },
];

export interface FeedFilters {
  authorName: string;
  profession: string;
  gender: string;
}

export const EMPTY_FILTERS: FeedFilters = {
  authorName: "",
  profession: "",
  gender: "",
};

/**
 * How many filters are narrowing the feed right now. Doubles as the badge
 * count on the filter button and as the "is anything applied" test.
 */
export function activeFilterCount(filters: FeedFilters = EMPTY_FILTERS): number {
  return [filters.profession, filters.authorName, filters.gender].filter(
    Boolean,
  ).length;
}

/**
 * The filters as `/stories` expects them. Unset filters are left out
 * entirely so the request URL stays readable and the API keeps defaults.
 */
export function feedQuery(filters: FeedFilters = EMPTY_FILTERS) {
  const params: Record<string, string> = {};
  if (filters.profession) params.profession = filters.profession;
  if (filters.authorName) params.authorName = filters.authorName;
  if (filters.gender) params.gender = filters.gender;
  return params;
}
