/**
 * The chapters of a life — the select the author picks from in the metadata
 * step and the grouping the profile renders by. Mirrors the backend's
 * LIFE_CHAPTERS (models/Story.js) so a story is always grouped somewhere the
 * feed can query.
 */
export const CHAPTER_OPTIONS = [
  "Childhood",
  "School Life",
  "College Life",
  "Relationship / Love Life",
  "Career",
  "Marriage",
  "Family",
  "Other",
];

export default CHAPTER_OPTIONS;
