import Story from "../models/Story.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import { flattenUser, withId } from "../utils/helpers.js";

import { deleteObject } from "../config/r2.js";
import { sanitizeHtml } from "../utils/sanitizeHtml.js";

/**
 * Uploads land straight in R2 via presigned URLs — the body only ever
 * carries { url, key }. Anything malformed becomes null instead of writing
 * garbage references.
 */
function sanitizeImageRef(ref) {
  if (!ref || typeof ref !== "object" || !ref.url) return null;

  return { url: String(ref.url).trim(), key: String(ref.key || "").trim() };
}
import {
  forbiddenError,
  notFoundError,
  validationError,
} from "../utils/errors.js";


const LIFE_CHAPTERS = [
  "Childhood",
  "School Life",
  "College Life",
  "Relationship / Love Life",
  "Career",
  "Marriage",
  "Family",
];

/** The default title for the chapter sitting in a given slot. */
function chapterName(order) {
  const index = Number(order);
  return LIFE_CHAPTERS[index] || `Chapter ${index + 1}`;
}


const AUTHOR_POPULATE =
  "fullName avatar author.profession author.verification.status";

const PUBLIC_VISIBILITIES = ["public"];

const VISIBILITY_LEVELS = ["public", "private"];

/** Upper bound on sanitized rich-text story content, in characters. */
const MAX_CONTENT_LENGTH = 200000;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Simple text search across title and story content.
 */
function textMatches(story, query) {
  const q = query.toLowerCase();
  if (story.title?.toLowerCase().includes(q)) return true;
  if (story.chapters?.some((ch) =>
    ch.stories?.some(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.content?.toLowerCase().includes(q)
    )
  )) return true;
  return false;
}

async function findOwnedStory({ authorId, storyId }) {
  const story = await Story.findOne({ _id: storyId, author: authorId });

  if (!story) {
    throw notFoundError("Story not found.");
  }

  return story;
}

/**
 * Media descriptors stored on story entries. Photos and videos only — media
 * is uploaded by the client straight to R2 via presigned URLs
 * (POST /uploads/presign); the server only ever stores the resulting
 * URL + key.
 */
const ALLOWED_MEDIA_TYPES = ["image", "video"];

/**
 * Validate/normalize a media descriptor list sent from the client.
 */
export function sanitizeMediaList(media) {
  if (!Array.isArray(media)) return [];

  return media
    .filter((m) => m && typeof m === "object" && m.url)
    .map((m) => ({
      url: String(m.url),
      key: m.key || "",
      type: ALLOWED_MEDIA_TYPES.includes(m.type) ? m.type : "image",
      caption: typeof m.caption === "string" ? m.caption.trim() : "",
    }));
}

/** Normalized R2 references behind one media list (key when known, else url). */
function mediaRefs(list = []) {
  return (list || [])
    .filter((m) => m && (m.key || m.url))
    .map((m) => ({ key: m.key || "", url: m.url || "" }));
}

/** Every media reference a set of chapters still points at. */
function collectMediaRefs(chapters = []) {
  return (chapters || []).flatMap((chapter) =>
    (chapter.stories || []).flatMap((entry) => mediaRefs(entry.media)),
  );
}

/** True when a previous media reference is still part of a list. */
function stillReferenced(ref, refs) {
  return refs.some(
    (r) => (ref.key && r.key === ref.key) || (ref.url && r.url === ref.url),
  );
}

/**
 * Deletes the R2 objects behind media descriptors that were dropped by an
 * update. Best-effort — they are only leftovers (keys are server-minted and
 * unique to the upload that created them), so a storage hiccup must never
 * fail the author's save.
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

/**
 * Normalize one story entry. Everything a chapter holds is written here:
 * the text, the media and who may read it.
 */
function sanitizeStoryEntry(entry = {}) {
  return {
    ...(entry._id ? { _id: entry._id } : {}),
    title: entry.title || "",
    storyType: entry.storyType || "experience",
    // Rich-text content is sanitized on every write path — the wizard saves
    // the whole lifebook in one PATCH.
    content: sanitizeHtml(entry.content || ""),
    dateLabel: entry.dateLabel || "",
    location: entry.location || "",
    media: sanitizeMediaList(entry.media),
    visibility: VISIBILITY_LEVELS.includes(entry.visibility)
      ? entry.visibility
      : "public",
    status: entry.status === "published" ? "published" : "draft",
  };
}

/**
 * Normalize one chapter: its title, its slot, and the stories inside it.
 * A chapter has no description, media or visibility of its own.
 */
function sanitizeChapter(chapter = {}, fallbackOrder = 0) {
  const order = Number.isFinite(Number(chapter.order))
    ? Number(chapter.order)
    : fallbackOrder;

  return {
    ...(chapter._id ? { _id: chapter._id } : {}),
    order,
    title: chapter.title?.trim() || chapterName(order),
    stories: (Array.isArray(chapter.stories) ? chapter.stories : []).map(
      sanitizeStoryEntry,
    ),
  };
}

/**
 * Creates a lifebook, optionally seeding the first chapter.
 */
export async function createStory({ authorId, body }) {
  let chapters = parseMaybeJson(body.chapters) ?? [];
  if (!Array.isArray(chapters)) chapters = [];

  const { title = "", language = "English" } = body;
  const cleanTitle = title?.trim() || "";

  // An explicit, valid visibility wins; otherwise the lifebook opens public.
  const visibility = VISIBILITY_LEVELS.includes(body.visibility)
    ? body.visibility
    : "public";

  // The banner was uploaded by the browser straight to R2 — only its
  // references travel in the body.
  const bannerImage = sanitizeImageRef(body.bannerImage);

  const authorDoc = await User.findById(authorId)
    .select("author.profession")
    .lean();

  const finalChapters = chapters.map(sanitizeChapter);

  return Story.create({
    author: authorId,
    authorProfession: authorDoc?.author?.profession
      ? authorDoc.author.profession.toLowerCase()
      : null,
    title: cleanTitle,
    visibility,
    language,
    chapters: finalChapters,
    bannerImage,
    status: "draft",
  });
}

/**
 * Updates lifebook metadata and/or chapters. Authors have full control —
 * editing is allowed in any state, including published lifebooks.
 */
export async function updateStory({ authorId, storyId, body }) {
  const story = await findOwnedStory({ authorId, storyId });

  // Everything the lifebook referenced before this update. Anything the
  // update drops — media the author removed, a replaced banner — is deleted
  // from R2 after the save lands below, so the main store never accumulates
  // discarded uploads.
  const previousMedia = collectMediaRefs(story.chapters);
  const previousBanner = story.bannerImage?.url
    ? { key: story.bannerImage.key || "", url: story.bannerImage.url }
    : null;

  let { title, visibility, language, status } = body;

  if (body.chapters !== undefined) {
    const chaptersUpdate = parseMaybeJson(body.chapters) ?? [];
    story.chapters = (Array.isArray(chaptersUpdate) ? chaptersUpdate : []).map(
      sanitizeChapter,
    );
  }

  if (title !== undefined) story.title = title.trim();
  if (visibility !== undefined) story.visibility = visibility;
  if (language !== undefined) story.language = language;
  if (status !== undefined && ["draft", "published"].includes(status)) {
    story.status = status;
  }

  if (body.bannerImage !== undefined) {
    story.bannerImage = sanitizeImageRef(body.bannerImage);
  }

  await story.save();

  // Deleted only after a successful save — a failed save must never cost
  // the author a still-referenced file.
  const nextMedia =
    body.chapters !== undefined ? collectMediaRefs(story.chapters) : previousMedia;
  const droppedMedia = previousMedia.filter((ref) => !stillReferenced(ref, nextMedia));
  if (previousBanner && previousBanner.url !== (story.bannerImage?.url || "")) {
    droppedMedia.push(previousBanner);
  }
  await releaseMedia(droppedMedia);

  return story;
}

/**
 * Deletes a lifebook. Authors have full control — deletion is allowed in
 * any state, including published lifebooks.
 */
export async function deleteStory({ authorId, storyId }) {
  const story = await findOwnedStory({ authorId, storyId });

  // The lifebook's photos and banner go with it — collect them before the
  // documents are gone, then clean the R2 objects after the deletion lands.
  const removedMedia = collectMediaRefs(story.chapters);
  if (story.bannerImage?.url) {
    removedMedia.push({ key: story.bannerImage.key || "", url: story.bannerImage.url });
  }

  await story.deleteOne();
  await releaseMedia(removedMedia);
}

/**
 * Drafts (anything not published) for the logged-in author.
 */
export async function listDrafts({ authorId, page, limit }) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Number(limit) || 20, 50);

  const filter = { author: authorId, status: { $ne: "published" } };

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
 * A single lifebook by id or slug, with the viewer's like state.
 * Non-owners only see published public lifebooks, and only chapters/stories
 * their access level allows (public / private).
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

  // lean() bypasses schema transforms — flatten the populated author.
  story.author = flattenUser(story.author);
  if (!story.id && story._id) story.id = String(story._id);

  const isOwner =
    viewer?.id && story.author?._id?.toString() === viewer.id.toString();

  // Access check: Owner sees all states, public requester only sees
  // published & public lifebooks
  if (!isOwner) {
    if (story.status !== "published" || story.visibility !== "public") {
      throw forbiddenError("You do not have permission to view this story.");
    }
  }

  // Visibility lives on each story, so a non-owner reads only the published,
  // public stories — and only the chapters that still hold any.
  if (!isOwner && story.chapters) {
    story.chapters = story.chapters
      .map((ch) => ({
        ...ch,
        stories: (ch.stories || []).filter(
          (s) =>
            s.status === "published" &&
            PUBLIC_VISIBILITIES.includes(s.visibility),
        ),
      }))
      .filter((ch) => ch.stories.length > 0);
  }

  let likedByUser = false;

  if (viewer?.id) {
    const existingLike = await Like.findOne({
      story: story._id,
      user: viewer.id,
    });
    likedByUser = Boolean(existingLike);
  }

  return { ...story, likedByUser };
}

/**
 * Published, public feed with filters: author profession, author name and
 * author gender. `q` text search is no longer part of this endpoint
 * (search was removed).
 */
export async function listStories({ query: queryParams, viewer }) {
  const { type, author, profession, authorName, gender } = queryParams;

  const page = Math.max(Number(queryParams.page) || 1, 1);
  const limit =
    type === "latest" || type === "trending"
      ? 10
      : Math.min(Number(queryParams.limit) || 20, 50);

  const filter = { status: "published", visibility: "public" };

  if (author) filter.author = author;

  if (profession?.trim()) {
    filter.authorProfession = new RegExp(
      `^${escapeRegex(profession.trim().toLowerCase())}$`,
      "i",
    );
  }

  // Author name filter — case-insensitive partial match on fullName.
  // Only actual story authors are matched.
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

  // Author gender filter
  if (gender && ["Male", "Female", "Other"].includes(gender)) {
    const genderAuthors = await User.find({ "author.gender": gender, roles: "author" })
      .select("_id")
      .lean();
    filter.author = { ...(filter.author || {}), $in: genderAuthors.map((a) => a._id) };
  }

  let query = Story.find(filter)
    .select(
      `
        title
        slug
        bannerImage
        chapters.title
        chapters.order
        chapters.stories.title
        chapters.stories.storyType
        chapters.stories.media
        author
        authorProfession
        language
        featured
        stats
        recentLikers
        publishedAt
        createdAt
      `,
    )
    .populate("author", AUTHOR_POPULATE);

  switch (type) {
    case "trending":
      query = query.sort({
        "stats.likes": -1,
        "stats.comments": -1,
        publishedAt: -1,
      });
      break;

    case "latest":
    default:
      query = query.sort({ publishedAt: -1 });
  }

  const [stories, total] = await Promise.all([
    query
      .skip(type ? 0 : (page - 1) * limit)
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
      page: type ? 1 : page,
      limit,
      total,
      pages: type ? 1 : Math.ceil(total / limit),
    },
  };
}

/**
 * Adds a chapter — a slot in the life story structure (0 = Childhood,
 * 1 = School Life, …) with its title. Callers name the slot with `order`;
 * without one the next free slot is used.
 */
export async function addChapter({ authorId, storyId, body = {} }) {
  const story = await findOwnedStory({ authorId, storyId });

  const nextFree = story.chapters.reduce(
    (max, ch) => Math.max(max, ch.order + 1),
    0,
  );
  const order = Number.isFinite(Number(body.order))
    ? Number(body.order)
    : nextFree;

  if (story.chapters.some((ch) => ch.order === order)) {
    throw validationError("That chapter already exists.");
  }

  story.chapters.push({
    title: body.title?.trim() || chapterName(order),
    stories: [],
    order,
  });

  await story.save();

  return story;
}

/**
 * Renames a chapter. The title is the author's own — the seven chapters of
 * life start with the names from the life story structure, and a chapter of
 * their own can be called anything.
 */
export async function updateChapter({ authorId, storyId, chapterId, body = {} }) {
  const story = await findOwnedStory({ authorId, storyId });

  const chapter = story.chapters.id(chapterId);
  if (!chapter) {
    throw notFoundError("Chapter not found.");
  }

  const title = body.title?.trim();
  if (!title) {
    throw validationError("Chapter title is required.");
  }

  chapter.title = title;

  await story.save();

  return story;
}

export async function deleteChapter({ authorId, storyId, chapterId }) {
  const story = await findOwnedStory({ authorId, storyId });

  const chapter = story.chapters.id(chapterId);
  if (!chapter) {
    throw notFoundError("Chapter not found.");
  }

  // Removing a chapter does not renumber the rest: `order` is the phase of
  // life it stands for, not its position in the list.
  const removedMedia = collectMediaRefs([chapter]);
  story.chapters.pull(chapterId);

  await story.save();
  await releaseMedia(removedMedia);

  return story;
}

/**
 * Validates story fields sent for create/update.
 */
function sanitizeStoryInput(body = {}) {
  const errors = [];

  if (body.title === undefined || !String(body.title).trim()) {
    errors.push("Story title is required.");
  }

  const storyType = body.storyType || "experience";
  if (
    !["experience", "achievement", "challenge", "diseases", "failures", "memory", "lesson", "other"].includes(
      storyType,
    )
  ) {
    errors.push("Invalid story type.");
  }

  if (errors.length > 0) {
    throw validationError(errors.join(" "));
  }

  // Story content is authored rich text — sanitize before it is stored.
  const content = sanitizeHtml(body.content || "");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw validationError("Story content is too long.");
  }

  return {
    title: String(body.title).trim(),
    storyType,
    content,
    dateLabel: body.dateLabel || "",
    location: body.location || "",
    media: sanitizeMediaList(body.media),
    visibility: VISIBILITY_LEVELS.includes(body.visibility)
      ? body.visibility
      : "public",
  };
}

/**
 * Adds a story to a chapter. Optionally publish it immediately.
 */
export async function addChapterStory({ authorId, storyId, chapterId, body }) {
  const story = await findOwnedStory({ authorId, storyId });

  const chapter = story.chapters.id(chapterId);
  if (!chapter) {
    throw notFoundError("Chapter not found.");
  }

  const input = sanitizeStoryInput(body);
  const publish = body.publish === true || body.status === "published";

  chapter.stories.push({
    ...input,
    status: publish ? "published" : "draft",
    publishedAt: publish ? new Date() : null,
  });

  // Publishing a story publishes the lifebook
  if (publish && story.status !== "published") {
    story.status = "published";
  }

  await story.save();

  return story;
}

export async function updateChapterStory({
  authorId,
  storyId,
  chapterId,
  storyEntryId,
  body,
}) {
  const story = await findOwnedStory({ authorId, storyId });

  const chapter = story.chapters.id(chapterId);
  if (!chapter) {
    throw notFoundError("Chapter not found.");
  }

  const entry = chapter.stories.id(storyEntryId);
  if (!entry) {
    throw notFoundError("Story not found in this chapter.");
  }

  const input = sanitizeStoryInput({ ...body, title: body.title ?? entry.title });

  const previousMedia = mediaRefs(entry.media);

  entry.title = input.title;
  entry.storyType = input.storyType;
  entry.content = input.content;
  entry.dateLabel = input.dateLabel;
  entry.location = input.location;
  entry.media = input.media;
  // Visibility is the story's own; an update that doesn't mention it keeps
  // the level the author already chose.
  if (body.visibility !== undefined) {
    entry.visibility = input.visibility;
  }

  const publish = body.publish === true || body.status === "published";
  const unpublish = body.status === "draft";

  if (publish) {
    entry.status = "published";
    if (!entry.publishedAt) entry.publishedAt = new Date();
    if (story.status !== "published") story.status = "published";
  } else if (unpublish) {
    entry.status = "draft";
  }

  await story.save();

  // Media the author removed from this story is deleted from R2 too.
  await releaseMedia(
    previousMedia.filter((ref) => !stillReferenced(ref, mediaRefs(entry.media))),
  );

  return story;
}

export async function deleteChapterStory({
  authorId,
  storyId,
  chapterId,
  storyEntryId,
}) {
  const story = await findOwnedStory({ authorId, storyId });

  const chapter = story.chapters.id(chapterId);
  if (!chapter) {
    throw notFoundError("Chapter not found.");
  }

  const entry = chapter.stories.id(storyEntryId);
  if (!entry) {
    throw notFoundError("Story not found in this chapter.");
  }

  const removedMedia = mediaRefs(entry.media);
  chapter.stories.pull(storyEntryId);

  await story.save();
  await releaseMedia(removedMedia);

  return story;
}

/**
 * Publishes the whole lifebook synchronously — no review pipeline,
 * the author has full control. Also re-publishes published lifebooks.
 */
export async function publishStory({ authorId, storyId, body }) {
  const story = await findOwnedStory({ authorId, storyId });

  if (!story.title?.trim()) {
    throw validationError("Story title is required before publishing.");
  }

  if (!story.chapters || story.chapters.length === 0) {
    throw validationError("Story must have at least one chapter.");
  }

  // Sync denormalized profession in case author updated profile
  const authorDoc = await User.findById(story.author)
    .select("author.profession")
    .lean();
  if (authorDoc?.author?.profession) {
    story.authorProfession = authorDoc.author.profession.toLowerCase();
  }

  // Optional visibility change at publish time
  if (body?.visibility) {
    if (!VISIBILITY_LEVELS.includes(body.visibility)) {
      throw validationError("Invalid visibility value.");
    }
    story.visibility = body.visibility;
  }

  story.status = "published";

  // Mark all chapter stories published too
  story.chapters.forEach((chapter) => {
    chapter.stories.forEach((entry) => {
      entry.status = "published";
      if (!entry.publishedAt) entry.publishedAt = new Date();
    });
  });

  await story.save();

  return {
    id: story.id,
    status: story.status,
    visibility: story.visibility,
  };
}

/**
 * Unpublishes a lifebook back to draft — full author control.
 */
export async function unpublishStory({ authorId, storyId }) {
  const story = await findOwnedStory({ authorId, storyId });

  story.status = "draft";
  story.chapters.forEach((chapter) => {
    chapter.stories.forEach((entry) => {
      entry.status = "draft";
    });
  });

  await story.save();

  return { id: story.id, status: story.status };
}

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
        "author.verification.status": "approved",
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
