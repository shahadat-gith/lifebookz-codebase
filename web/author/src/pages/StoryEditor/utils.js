/**
 * Shape conversions for the writing wizard.
 *
 * A story is one flat document: title, banner, storyType, chapterName,
 * content and media. The wizard carries the local banner separately (it
 * uploads as soon as the author picks it), so nothing else is needed here
 * beyond the default story and the API payload shape.
 */

/** A blank story, with the defaults the API understands. */
export function emptyStory() {
  return {
    title: "",
    storyType: "experience",
    chapterName: "",
    content: "",
    media: [],
    visibility: "public",
    status: "draft",
  };
}

/**
 * The story as the API stores it: no local-only `id` keys, and a visibility
 * that is always one of the three levels. The banner stays out — it is
 * threaded separately through the wizard and merged in on save.
 */
export function toStoryEntry(story = {}) {
  const id = story.id || story._id;

  return {
    ...(id ? { _id: id } : {}),
    title: story.title || "",
    storyType: story.storyType || "experience",
    chapterName: story.chapterName || "",
    content: story.content || "",
    media: Array.isArray(story.media) ? story.media : [],
    visibility:
      ["public", "followers", "private"].includes(story.visibility)
        ? story.visibility
        : "public",
    status: story.status === "published" ? "published" : "draft",
  };
}
