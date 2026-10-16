import { countWords, richTextToPlain } from "../../utils/richText";
import { bookId, storyEntryId } from "../../utils/helpers";
import { storyThumbnail } from "../../utils/media";

/**
 * Derivations behind the story dashboard.
 *
 * Everything here works off the flat story documents the author already
 * owns, so the numbers on the dashboard can never disagree with the lists
 * beside them.
 */

/**
 * Every story document, newest first, with the fields the list cards need
 * already resolved.
 */
export function flattenStories(stories = []) {
  return (stories || [])
    .map((story) => ({
      id: storyEntryId(story),
      story,
      status: story.status === "published" ? "published" : "draft",
      words: countWords(story.content),
      preview: richTextToPlain(story.content).replace(/\s+/g, " ").trim(),
      thumb: storyThumbnail(story, story),
      mediaCount: (story.media || []).length,
    }))
    .sort(
      (a, b) =>
        new Date(b.story.updatedAt || b.story.createdAt || 0) -
        new Date(a.story.updatedAt || a.story.createdAt || 0),
    );
}

/** Headline numbers for the dashboard tiles. */
export function dashboardTotals(stories = []) {
  const rows = flattenStories(stories);

  return {
    stories: rows.length,
    published: rows.filter((r) => r.status === "published").length,
    drafts: rows.filter((r) => r.status === "draft").length,
    chapters: new Set(
      rows.map((r) => r.story.chapterName || "").filter(Boolean),
    ).size,
    likes: rows.reduce((n, row) => n + (row.story.stats?.likes || 0), 0),
    comments: rows.reduce((n, row) => n + (row.story.stats?.comments || 0), 0),
    media: rows.reduce((n, row) => n + (row.mediaCount || 0), 0),
  };
}

/**
 * Everyone who recently liked one of the author's stories, newest first,
 * tagged with the story they liked.
 */
export function recentLikers(stories = [], limit = 12) {
  return (stories || [])
    .flatMap((story) =>
      (story.recentLikers || []).map((liker) => ({
        key: `${storyEntryId(story)}:${liker.user || liker.fullName}`,
        name: liker.fullName || "Someone",
        avatar: liker.avatar || null,
        book: story.title || "Untitled story",
      })),
    )
    .slice(0, limit);
}
