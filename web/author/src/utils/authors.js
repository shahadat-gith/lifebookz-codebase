/**
 * Author badge state.
 *
 * Authors have no verification pipeline any more — the badge goes to
 * every upgraded author (root-level `isAuthor`, set by the upgrade form).
 */
export function isVerifiedAuthor(author) {
  return Boolean(author?.isAuthor);
}

/** An author's display name, with the fallback every view uses. */
export function authorName(author) {
  return author?.fullName || "Anonymous Author";
}
