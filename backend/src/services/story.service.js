import Story from "../models/Story.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import { flattenUser, withId } from "../utils/helpers.js";

import { deleteObject } from "../config/r2.js";
import { sanitizeHtml } from "../utils/sanitizeHtml.js";

import {
  forbiddenError,
  notFoundError,
  validationError,
} from "../utils/errors.js";

// ---------------------------------------------------------------------------
// Vocabulary shared with the model — the frontend selects mirror these.
// ---------------------------------------------------------------------------

import { STORY_TYPES } from "../models/Story.js";
export { STORY_TYPES, LIFE_CHAPTERS } from "../models/Story.js";

const AUTHOR_POPULATE = "fullName avatar author.profession isAuthor";

/** Feed queries read public, published rows only. */
const FEED_FILTER = { status: "published", visibility: "public" };

/** Upper bound on sanitized rich-text story content, in characters. */
const MAX_CONTENT_LENGTH = 200000;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Uploads land straight in R2 via presigned URLs — the body only ever
 * carries { url, key }. Anything malformed becomes null instead of writing
 * garbage references.
 */
function sanitizeImageRef(ref) {
  if (!ref || typeof ref !== "object" || !ref.url) return null;

  return { url: String(ref.url).trim(), key: String(ref.key || "").trim() };
}

/**
 * Validate/normalize the media list sent from the client. Optional — a story
 * publishes fine with an empty gallery.
 */
export function sanitizeMediaList(media) {
  if (!Array.isArray(media)) return [];

  return media
    .filter((m) => m && typeof m === "object" && m.url)
    .map((m) => ({
      url: String(m.url),
      key: String(m.key || ""),
      type: ["image", "video", "audio"].includes(m.type) ? m.type : "image",
      caption: typeof m.caption === "string" ? m.caption.trim().slice(0, 300) : "",
    }));
}

/**
 * Canonicalize the chapter name: the portal sends one of LIFE_CHAPTERS (it
 * is a select), but a non-empty custom name stays as the author wrote it so
 * grouping by chapter keeps working.
 */
function sanitizeChapterName(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 150);
}

/**
 * Validate a story payload across create and update:
 * title and banner are mandatory; content and media are optional.
 */
function sanitizeStoryInput(body = {}) {
  const errors = [];

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) errors.push("Story title is required.");

  const banner = sanitizeImageRef(body.bannerImage);
  if (!banner || !banner.url) {
    errors.push("A banner image is required.");
  }

  let storyType = body.storyType || "other";
  if (!STORY_TYPES.includes(storyType)) {
    errors.push("Invalid story type.");
    storyType = "other";
  }

  if (errors.length > 0) {
    throw validationError(errors.join(" "));
  }

  // Story content is authored rich text — sanitize before it is stored.
  const content = sanitizeHtml(body.content || "");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw validationError("Story content is too long.");
  }

  // Visibility is part of every write: the publish payload carries the
  // audience chosen on the final step, and it MUST land — updateStory
  // assigns input[key], so an undefined here would null out the stored
  // value and the like/feed filters (requires visibility:"public") would
  // 404 the story.
  const visibility = ["public", "followers", "private"].includes(body.visibility)
    ? body.visibility
    : "public";

  return {
    title,
    slug: body.slug, // only the model generates/manages slugs
    bannerImage: banner,
    storyType,
    chapterName: sanitizeChapterName(body.chapterName),
    content,
    media: sanitizeMediaList(body.media),
    visibility,
  };
}

/** Media references (key when known, else url) behind one media list. */
function mediaRefs(list = []) {
  return (list || [])
    .filter((m) => m && (m.key || m.url))
    .map((m) => ({ key: m.key || "", url: m.url || "" }));
}

/** True when a previous media reference is still part of a list. */
function stillReferenced(ref, refs) {
  return refs.some(
    (r) => (ref.key && r.key === ref.key) || (ref.url && r.url === ref.url),
  );
}

/**
 * Deletes the R2 objects behind media that an update dropped. Best-effort —
 * they are only leftovers (keys are server-minted), so a storage hiccup must
 * never fail the author's save.
 */
async function releaseMedia(refs = []) {
  const dropped = refs.filter((r) => r.key || r.url);
  if (dropped.length === 0) return;

  await Promise.allSettled(
    dropped.map((ref) =>
      deleteObject({ key: ref.key || undefined, url: ref.url || undefined }),
    ),
  );
}

async function findOwnedStory({ authorId, storyId }) {
  const story = await Story.findOne({ _id: storyId, author: authorId });

  if (!story) {
    throw notFoundError("Story not found.");
  }

  return story;
}

/** Sync the author's current profession onto the story (write-time copy). */
async function syncAuthorProfession(story) {
  const authorDoc = await User.findById(story.author)
    .select("author.profession")
    .lean();

  story.authorProfession = authorDoc?.author?.profession
    ? authorDoc.author.profession.toLowerCase()
    : null;
}

// ---------------------------------------------------------------------------
// Create / update / delete (author)
// ---------------------------------------------------------------------------

/**
 * Creates a story draft.
 */
export async function createStory({ authorId, body }) {
  const input = sanitizeStoryInput(body);

  return Story.create({
    author: authorId,
    title: input.title,
    bannerImage: input.bannerImage,
    storyType: input.storyType,
    chapterName: input.chapterName,
    content: input.content,
    media: input.media,
    status: "draft",
  });
}

/**
 * Updates an owned story (any state — full author control).
 * Media/banners dropped by the update are removed from R2 after the save.
 */
export async function updateStory({ authorId, storyId, body }) {
  const story = await findOwnedStory({ authorId, storyId });

  const previousRefs = [...mediaRefs(story.media), story.bannerImage?.key ? story.bannerImage : null].filter(Boolean);

  const input = sanitizeStoryInput({ ...story.toJSON(), ...body });
  const updates = [
    "title",
    "bannerImage",
    "storyType",
    "chapterName",
    "content",
    "media",
    "visibility",
    "status",
  ];

  for (const key of updates) {
    if (body[key] !== undefined) story[key] = input[key];
  }

  await story.save();

  const nextRefs = [...mediaRefs(story.media)];
  if (story.bannerImage?.url) nextRefs.push({ key: story.bannerImage.key || "", url: story.bannerImage.url });

  await releaseMedia(previousRefs.filter((ref) => !stillReferenced(ref, nextRefs)));

  return story;
}

/**
 * Deletes an owned story. Its banner and media are removed from R2 after
 * the deletion lands; likes and comments go with the document.
 */
export async function deleteStory({ authorId, storyId }) {
  const story = await findOwnedStory({ authorId, storyId });

  const removed = [...mediaRefs(story.media)];
  if (story.bannerImage?.url) removed.push({ key: story.bannerImage.key || "", url: story.bannerImage.url });

  await Promise.all([
    Like.deleteMany({ story: story._id }),
    Comment.deleteMany({ story: story._id }),
    story.deleteOne(),
  ]);

  await releaseMedia(removed);
}

// ---------------------------------------------------------------------------
// Publishing (author)
// ---------------------------------------------------------------------------

/**
 * Publishes a single story synchronously — no review pipeline. The author's
 * profile must be complete (the route enforces it too — requireProfileComplete).
 */
export async function publishStory({ authorId, storyId }) {
  const story = await findOwnedStory({ authorId, storyId });

  if (!story.title?.trim()) {
    throw validationError("Story title is required before publishing.");
  }

  // Sync the denormalized profession at publish time, so the feed filter
  // always reflects the author's current profile.
  await syncAuthorProfession(story);

  story.status = "published";

  await story.save();

  return {
    id: story.id,
    status: story.status,
    visibility: story.visibility,
    slug: story.slug,
  };
}

/**
 * Back to draft, any time, full author control.
 */
export async function unpublishStory({ authorId, storyId }) {
  const story = await findOwnedStory({ authorId, storyId });

  story.status = "draft";

  await story.save();

  return { id: story.id, status: story.status };
}

// ---------------------------------------------------------------------------
// Reads (author)
// ---------------------------------------------------------------------------

/**
 * The author's own stories — drafts first, then every state by recency.
 */
export async function listMyStories({ authorId, page, limit }) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Number(limit) || 50, 100);

  const filter = { author: authorId };

  const [stories, total] = await Promise.all([
    Story.find(filter)
      .sort({ updatedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Story.countDocuments(filter),
  ]);

  return {
    stories: stories.map(withId),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Drafts (anything not published) for the logged-in author.
 */
export async function listDrafts({ authorId, page, limit }) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Number(limit) || 20, 50);

  const filter = { author: authorId, status: "draft" };

  const [stories, total] = await Promise.all([
    Story.find(filter)
      .sort({ updatedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Story.countDocuments(filter),
  ]);

  return {
    stories: stories.map(withId),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}

// ---------------------------------------------------------------------------
// Reads (public — reader + author portals)
// ---------------------------------------------------------------------------

/**
 * A single story by id or slug, with the viewer's like state.
 * Non-owners only see published public stories.
 */
export async function getStoryDetail({ storyId, viewer }) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(storyId);
  const filter = isObjectId ? { _id: storyId } : { slug: storyId };

  const story = await Story.findOne(filter)
    .populate("author", AUTHOR_POPULATE)
    .lean();

  if (!story) {
    throw notFoundError("Story not found.");
  }

  story.author = flattenUser(story.author);
  if (!story.id && story._id) story.id = String(story._id);

  const isOwner =
    viewer?.id && String(story.author?._id) === String(viewer.id);

  if (!isOwner) {
    if (story.status !== "published" || story.visibility !== "public") {
      throw forbiddenError("You do not have permission to view this story.");
    }
  }

  let likedByUser = false;

  if (viewer?.id) {
    const existingLike = await Like.findOne({
      story: story._id,
      user: viewer.id,
    }).select("_id");
    likedByUser = Boolean(existingLike);
  }

  return { ...story, likedByUser };
}

function viewerFilter(viewer) {
  // The author reads their own private rows too, everywhere.
  if (!viewer?.id) return FEED_FILTER;
  return {
    status: "published",
    $or: [{ visibility: "public" }, { author: viewer.id }],
  };
}

/**
 * The feed: one story per row, filterable.
 *
 * Query parameters:
 *   storyType  — memory, life_lesson, achievement, advice, experience, …
 *   chapter    — the LIFE_CHAPTERS grouping (Chapter name in the select)
 *   profession — the author's profession (denormalized, lowercase)
 *   authorName — case-insensitive prefix-ish match on fullName
 *   gender     — the author's gender
 *   page/limit — server-side pagination, hard-capped at 50
 */
export async function listStories({ query: queryParams, viewer }) {
  const { storyType, chapter, profession, authorName, gender } = queryParams;

  const page = Math.max(Number(queryParams.page) || 1, 1);
  const limit = Math.min(Number(queryParams.limit) || 20, 50);

  const filter = viewerFilter(viewer);

  if (STORY_TYPES.includes(storyType)) filter.storyType = storyType;

  if (chapter?.trim()) {
    filter.chapterName = new RegExp(
      `^${escapeRegex(chapter.trim())}$`,
      "i",
    );
  }

  if (profession?.trim()) {
    filter.authorProfession = new RegExp(
      `^${escapeRegex(profession.trim().toLowerCase())}$`,
      "i",
    );
  }

  // Author name filter — case-insensitive partial match on fullName. Only
  // actual story authors are matched, and the ids tighten `author` rather
  // than loosening it.
  if (authorName?.trim()) {
    const nameRx = new RegExp(escapeRegex(authorName.trim()), "i");
    const matchingAuthors = await User.find({
      roles: "author",
      fullName: nameRx,
    })
      .select("_id")
      .lean();
    filter.author = { ...(filter.author || {}), $in: matchingAuthors.map((a) => a._id) };
  }

  if (gender && ["Male", "Female", "Other"].includes(gender)) {
    const genderAuthors = await User.find({ "author.gender": gender, roles: "author" })
      .select("_id")
      .lean();
    filter.author = { ...(filter.author || {}), $in: genderAuthors.map((a) => a._id) };
  }

  const [stories, total] = await Promise.all([
    Story.find(filter)
      .select(
        "title slug bannerImage storyType chapterName author authorProfession language featured stats recentLikers publishedAt createdAt media",
      )
      .populate("author", AUTHOR_POPULATE)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Story.countDocuments(filter),
  ]);

  const likedMap = {};

  if (viewer?.id && stories.length) {
    const storyIds = stories.map((story) => story._id);

    const likes = await Like.find({ user: viewer.id, story: { $in: storyIds } })
      .select("story")
      .lean();

    likes.forEach((like) => {
      likedMap[like.story.toString()] = true;
    });
  }

  const enrichedStories = stories.map((story) => ({
    ...withId(story),
    author: flattenUser(story.author),
    likedByUser: likedMap[story._id.toString()] ?? false,
  }));

  return {
    stories: enrichedStories,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/** Top of the feed: the newest published stories, limit fixed at 10. */
export async function latestStories({ viewer }) {
  return listStories({ query: { limit: 10, page: 1 }, viewer });
}

/** Trending: the stories with the most engagement right now. */
export async function trendingStories({ viewer }) {
  const limit = 10;

  const stories = await Story.find(FEED_FILTER)
    .select(
      "title slug bannerImage storyType chapterName author authorProfession language featured stats recentLikers publishedAt createdAt media",
    )
    .populate("author", AUTHOR_POPULATE)
    .sort({ "stats.likes": -1, "stats.comments": -1, publishedAt: -1 })
    .limit(limit)
    .lean();

  const enrichedStories = stories.map((story) => ({
    ...withId(story),
    author: flattenUser(story.author),
    likedByUser: false,
  }));

  return {
    stories: enrichedStories,
    pagination: { page: 1, limit, total: enrichedStories.length, pages: 1 },
  };
}

// ---------------------------------------------------------------------------
// Social (sort / likes / comments) — unchanged contracts, per-story now
// ---------------------------------------------------------------------------

/**
 * Like / unlike a story. Any signed-in account can like — the caller's
 * collection and display name are recorded so the like renders correctly
 * whatever kind of account it came from.
 */
export async function toggleLike({
  storyId,
  userId,
  fullName = "A reader",
}) {
  const story = await Story.findOne({
    _id: storyId,
    status: "published",
    visibility: "public",
  }).select("_id author slug");

  if (!story) {
    throw notFoundError("Story not found.");
  }

  const existing = await Like.findOne({ story: storyId, user: userId });

  if (existing) {
    await Promise.all([
      existing.deleteOne(),
      Story.findByIdAndUpdate(storyId, {
        $inc: { "stats.likes": -1 },
        $pull: { recentLikers: { user: userId } },
      }),
      User.findByIdAndUpdate(story.author, {
        $inc: { "author.stats.likes": -1 },
      }),
    ]);

    return { liked: false };
  }

  await Promise.all([
    Like.create({ story: storyId, user: userId }),
    Story.findByIdAndUpdate(storyId, {
      $inc: { "stats.likes": 1 },
      $push: {
        recentLikers: {
          $each: [{ user: userId, fullName }],
          $position: 0,
          $slice: 3,
        },
      },
    }),
    User.findByIdAndUpdate(story.author, {
      $inc: { "author.stats.likes": 1 },
    }),
  ]);

  return { liked: true };
}

export async function listLikes({ storyId }) {
  return Like.find({ story: storyId })
    .populate("user", "fullName avatar")
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Flatten a populated reply for rendering.
 *
 * Replies store only the author's id; the name and avatar are populated on
 * every read, so a reply always carries the author's current profile — and
 * the clients keep reading the same `fullName` / `avatar` fields.
 */
function shapeReply(reply) {
  const author = reply.author && typeof reply.author === "object" ? reply.author : null;

  return {
    ...reply,
    ...(reply._id && !reply.id ? { id: String(reply._id) } : {}),
    author: author?._id || reply.author,
    fullName: author?.fullName || "Author",
    avatar: author?.avatar?.url || "",
  };
}

/** Populate every account reference on a comment, then flatten its replies. */
function commentPopulate(query) {
  return query
    .populate("user", "fullName avatar")
    .populate("replies.author", "fullName avatar");
}

/** Shape one comment (and its replies) for the clients. */
function shapeComment(comment) {
  return {
    ...comment,
    ...(comment._id && !comment.id ? { id: String(comment._id) } : {}),
    // Populate resolves through the comment's user reference; a guard
    // keeps a malformed row from breaking the whole comment list.
    user: comment.user || { _id: null, fullName: "A reader", avatar: { url: "" } },
    replies: (comment.replies || []).map(shapeReply),
  };
}

/**
 * Comment on a story. Readers, authors and experts can all comment — the
 * account type and a copy of the display name travel with the row.
 */
export async function createComment({
  storyId,
  userId,
  content,
}) {
  if (!content?.trim()) {
    throw validationError("Comment cannot be empty.");
  }

  const story = await Story.findOne({
    _id: storyId,
    status: "published",
    visibility: "public",
  }).select("_id");

  if (!story) {
    throw notFoundError("Story not found.");
  }

  const comment = await Comment.create({
    story: storyId,
    user: userId,
    content: content.trim(),
  });

  await Story.findByIdAndUpdate(storyId, { $inc: { "stats.comments": 1 } });

  const saved = await commentPopulate(Comment.findById(comment.id)).lean();

  return shapeComment(saved);
}

export async function updateComment({
  commentId,
  userId,
  content,
}) {
  if (!content?.trim()) {
    throw validationError("Comment cannot be empty.");
  }

  const comment = await Comment.findOne({ _id: commentId, user: userId });

  if (!comment) {
    throw notFoundError("Comment not found.");
  }

  comment.content = content.trim();
  comment.edited = true;

  await comment.save();

  return comment;
}

export async function deleteComment({ commentId, userId }) {
  const comment = await Comment.findOne({ _id: commentId, user: userId });

  if (!comment) {
    throw notFoundError("Comment not found.");
  }

  await Promise.all([
    comment.deleteOne(),
    Story.findByIdAndUpdate(comment.story, { $inc: { "stats.comments": -1 } }),
  ]);
}

export async function listComments({ storyId, page, limit, viewerId }) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Number(limit) || 20, 50);

  const [comments, total] = await Promise.all([
    commentPopulate(Comment.find({ story: storyId }))
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),

    Comment.countDocuments({ story: storyId }),
  ]);

  const viewerIdStr = viewerId ? String(viewerId) : null;

  return {
    comments: comments.map((c) => ({
      ...shapeComment(c),
      likeCount: c.likes?.length || 0,
      likedByMe:
        viewerIdStr && c.likes
          ? c.likes.some((l) => String(l.who) === viewerIdStr)
          : false,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Toggle a like on a comment. Any signed-in account (user, author or
 * expert) can like comments.
 */
export async function toggleCommentLike({ commentId, whoId }) {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw notFoundError("Comment not found.");
  }

  const existing = comment.likes.find(
    (l) => String(l.who) === String(whoId),
  );

  if (existing) {
    comment.likes = comment.likes.filter(
      (l) => String(l.who) !== String(whoId),
    );
  } else {
    comment.likes.push({ who: whoId });
  }

  await comment.save();

  return {
    liked: !existing,
    likeCount: comment.likes.length,
  };
}

/**
 * Reply to a comment — story author only (route + ownership both enforced).
 */
export async function replyToComment({ commentId, authorId, content }) {
  if (!content?.trim()) {
    throw validationError("Reply cannot be empty.");
  }

  const comment = await Comment.findById(commentId).populate(
    "story",
    "author",
  );

  if (!comment) {
    throw notFoundError("Comment not found.");
  }

  if (String(comment.story.author) !== String(authorId)) {
    throw forbiddenError("Only the story's author can reply to comments.");
  }

  comment.replies.push({ author: authorId, content: content.trim() });

  await comment.save();

  // Re-read so the reply carries the author's current name and avatar.
  const saved = await commentPopulate(
    Comment.findById(commentId).select("replies"),
  ).lean();

  const replies = saved?.replies || [];
  return shapeReply(replies[replies.length - 1]);
}

/**
 * Distinct professions across approved, active authors (most common
 * first) — the story filter modal's options.
 */
export async function listProfessions() {
  const professions = await User.aggregate([
    {
      $match: {
        roles: "author",
        status: "active",
        "author.profession": { $type: "string", $ne: "" },
      },
    },
    {
      $group: {
        _id: { $toLower: "$author.profession" },
        label: { $first: "$author.profession" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, label: 1 } },
    { $limit: 50 },
  ]);

  return professions.map((p) => ({
    value: p._id,
    label: p.label,
    count: p.count,
  }));
}
