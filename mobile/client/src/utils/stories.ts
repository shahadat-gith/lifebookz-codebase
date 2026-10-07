import type { Chapter, Comment, MediaRef, Story } from "../types";

/**
 * The API returns media fields (avatar, banner, cover) as `{ url, key }`
 * objects; a few endpoints send plain strings. Normalize to a URL string.
 */
export function mediaUrl(ref: MediaRef): string {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  return ref.url || "";
}

/** Whether an author carries an approved verification badge. */
export function isVerifiedAuthor(author?: { verification?: { status?: string } }) {
  return author?.verification?.status === "approved";
}

/** An author's display name, with the fallback every view uses. */
export function authorName(author?: { fullName?: string }) {
  return author?.fullName || "Anonymous Author";
}

/** Chapters in reading order, whether or not they carry an order index. */
export function sortChapters(chapters?: Chapter[]): Chapter[] {
  return [...(chapters || [])].sort((a, b) => {
    const orderA = a.order ?? a.chapterNumber ?? 0;
    const orderB = b.order ?? b.chapterNumber ?? 0;
    return orderA - orderB;
  });
}

/** A story's stable id, whichever key the API used. */
export function storyId(story?: Story | null) {
  return story?._id || story?.id || "";
}

/** A story's cover art: banner first, legacy coverImage second. */
export function storyImage(story?: Story | null): string {
  return mediaUrl(story?.bannerImage) || mediaUrl(story?.coverImage) || "";
}

/**
 * How many likes a comment has, whichever shape the API sent:
 * a computed `likeCount` number, a raw `likes` subdocument with a `who`
 * array, or a plain number.
 */
export function commentLikeCount(comment?: Comment | null): number {
  if (!comment) return 0;
  if (typeof comment.likeCount === "number") return comment.likeCount;
  if (typeof comment.likes === "number") return comment.likes;
  const who = (comment.likes as { who?: unknown[] } | undefined)?.who;
  return Array.isArray(who) ? who.length : 0;
}

/** Whether the given user has already liked a comment. */
export function commentLikedByMe(
  comment?: Comment | null,
  userId?: string | null,
): boolean {
  if (!comment) return false;
  if (typeof comment.likedByMe === "boolean") return comment.likedByMe;
  if (typeof comment.likedByUser === "boolean") return comment.likedByUser;
  const who = (comment.likes as { who?: unknown[] } | undefined)?.who;
  if (Array.isArray(who) && userId) {
    return who.some((id) => String(id) === String(userId));
  }
  return false;
}
