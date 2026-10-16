/**
 * Which picture represents a story.
 *
 * A story carries a mandatory banner and optional media; which one leads
 * depends on what is being shown, but the fallback chain is the same
 * everywhere, so it lives here.
 */

/** The story's own banner, or — if it has none — the first photo inside it. */
export function lifebookCover(story) {
  return (
    story?.bannerImage?.url ||
    (story?.media || []).find((m) => m.type === "image" && m.url)?.url ||
    null
  );
}

/** A story's own photo, falling back to its banner. */
export function storyThumbnail(story) {
  const own = (story?.media || []).find(
    (media) => media.type === "image" && media.url,
  );
  return own?.url || story?.bannerImage?.url || null;
}
