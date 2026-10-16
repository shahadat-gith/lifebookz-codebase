import * as storyService from "../services/story.service.js";

const viewerOf = (req) =>
  req.user ? { id: req.user.id, role: req.role } : null;

/**
 * POST /stories
 * Create a story draft.
 */
export async function create(req, res, next) {
  try {
    const story = await storyService.createStory({
      authorId: req.user.id,
      body: req.body,
    });

    res.status(201).json({ success: true, data: story });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /stories/:storyId
 * Update a story (allowed in any state — full author control).
 */
export async function update(req, res, next) {
  try {
    const story = await storyService.updateStory({
      authorId: req.user.id,
      storyId: req.params.storyId,
      body: req.body,
    });

    res.json({ success: true, data: story });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /stories/:storyId
 * Delete a story (allowed in any state — full author control).
 */
export async function remove(req, res, next) {
  try {
    await storyService.deleteStory({
      authorId: req.user.id,
      storyId: req.params.storyId,
    });

    res.json({ success: true, message: "Story deleted successfully." });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /stories/drafts
 */
export async function getDrafts(req, res, next) {
  try {
    const data = await storyService.listDrafts({
      authorId: req.user.id,
      page: req.query.page,
      limit: req.query.limit,
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /stories/mine — everything the author owns (drafts included).
 */
export async function getMine(req, res, next) {
  try {
    const data = await storyService.listMyStories({
      authorId: req.user.id,
      page: req.query.page,
      limit: req.query.limit,
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /stories/:storyId
 * Single story by id or slug.
 */
export async function getStory(req, res, next) {
  try {
    const story = await storyService.getStoryDetail({
      storyId: req.params.storyId,
      viewer: viewerOf(req),
    });

    res.json({ success: true, data: story });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /stories
 * Published feed — one story per row. Filters: storyType, chapter,
 * profession, authorName, gender. Paged via page/limit.
 */
export async function list(req, res, next) {
  try {
    const data = await storyService.listStories({
      query: req.query,
      viewer: viewerOf(req),
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /stories/professions
 * Distinct professions across approved, active authors — the filter
 * modal's options.
 */
export async function getProfessions(req, res, next) {
  try {
    const professions = await storyService.listProfessions();

    res.json({ success: true, data: professions });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /stories/types
 * The storyType options the circular feed filters and the author select
 * render — served by the backend so clients never hard-code the list.
 */
export async function getTypes(_req, res, next) {
  try {
    const data = await storyService.STORY_TYPES;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /stories/latest — top of the feed (used by web + mobile home rails).
 */
export async function getLatest(req, res, next) {
  try {
    const data = await storyService.latestStories({ viewer: viewerOf(req) });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /stories/trending — most-liked published stories.
 */
export async function getTrending(req, res, next) {
  try {
    const data = await storyService.trendingStories({ viewer: viewerOf(req) });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /stories/:storyId/publish — synchronous, no review pipeline.
 */
export async function publish(req, res, next) {
  try {
    const data = await storyService.publishStory({
      authorId: req.user.id,
      storyId: req.params.storyId,
      body: req.body,
    });

    res.status(200).json({
      success: true,
      message: "Story published successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /stories/:storyId/unpublish — back to draft, any time.
 */
export async function unpublish(req, res, next) {
  try {
    const data = await storyService.unpublishStory({
      authorId: req.user.id,
      storyId: req.params.storyId,
    });

    res.json({
      success: true,
      message: "Story unpublished.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Who is acting: the account id and the name to denormalize onto story
 * likes. Works for readers, authors and experts alike — one user table.
 */
function actorOf(req) {
  return {
    userId: req.user.id,
    fullName: req.user.fullName || "A reader",
  };
}

export async function toggleLike(req, res, next) {
  try {
    const data = await storyService.toggleLike({
      storyId: req.params.storyId,
      ...actorOf(req),
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createComment(req, res, next) {
  try {
    const comment = await storyService.createComment({
      storyId: req.params.storyId,
      ...actorOf(req),
      content: req.body.content,
    });

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    next(error);
  }
}

export async function updateComment(req, res, next) {
  try {
    const comment = await storyService.updateComment({
      commentId: req.params.commentId,
      ...actorOf(req),
      content: req.body.content,
    });

    res.json({ success: true, data: comment });
  } catch ( error ) {
    next(error);
  }
}

export async function deleteComment(req, res, next) {
  try {
    await storyService.deleteComment({
      commentId: req.params.commentId,
      ...actorOf(req),
    });

    res.json({ success: true, message: "Comment deleted successfully." });
  } catch (error) {
    next(error);
  }
}

export async function getComments(req, res, next) {
  try {
    const data = await storyService.listComments({
      storyId: req.params.storyId,
      page: req.query.page,
      limit: req.query.limit,
      viewerId: req.user?.id,
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /stories/comments/:commentId/like
 * Toggle a like on a comment — any signed-in account (user/author/expert).
 */
export async function toggleCommentLike(req, res, next) {
  try {
    const result = await storyService.toggleCommentLike({
      commentId: req.params.commentId,
      whoId: req.user.id,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /stories/comments/:commentId/reply
 * Reply to a comment — story author only.
 */
export async function replyToComment(req, res, next) {
  try {
    const reply = await storyService.replyToComment({
      commentId: req.params.commentId,
      authorId: req.user.id,
      content: req.body?.content,
    });

    res.status(201).json({ success: true, data: reply });
  } catch (error) {
    next(error);
  }
}
