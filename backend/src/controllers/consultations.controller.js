import * as consultService from "../services/consultations.service.js";

/**
 * POST /consultations/match
 */
export async function matchExperts(req, res, next) {
  try {
    const { experts, category, matched } = await consultService.matchExperts({
      problem: req.body.problem,
      category: req.body.category,
      limit: req.body.limit,
    });

    return res.json({
      success: true,
      data: { experts, total: experts.length, category, matched },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /consultations/requests — user creates a consultation request.
 */
export async function createRequest(req, res, next) {
  try {
    const consultation = await consultService.createConsultation({
      user: req.user,
      input: req.body,
    });

    return res.status(201).json({ success: true, data: consultation });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /consultations/mine — the signed-in user's consultations.
 * Server-side pagination: ?limit=10&page=1 →
 *   { consultations, total, page, limit, hasMore }
 */
export async function listMine(req, res, next) {
  try {
    const result = await consultService.listMine({
      userId: req.user?.id,
      role: "user",
      status: req.query.status,
      limit: req.query.limit,
      page: req.query.page,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /consultations/expert — the signed-in expert's consultations.
 * Same server-side pagination as /mine.
 */
export async function listForExpert(req, res, next) {
  try {
    const result = await consultService.listMine({
      userId: req.user?.id,
      role: "expert",
      status: req.query.status,
      limit: req.query.limit,
      page: req.query.page,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /consultations/:consultationId — participant only.
 */
export async function getOne(req, res, next) {
  try {
    const consultation = await consultService.getForParticipant({
      id: req.params.consultationId,
      userId: req.user?.id,
      role: req.role,
      roles: req.roles,
    });

    return res.json({ success: true, data: consultation });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /consultations/:consultationId/accept — expert only, concurrency-safe.
 */
export async function accept(req, res, next) {
  try {
    const consultation = await consultService.acceptConsultation({
      expertId: req.user?.id,
      consultationId: req.params.consultationId,
    });

    return res.json({ success: true, data: consultation });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /consultations/:consultationId/decline — expert only.
 */
export async function decline(req, res, next) {
  try {
    const consultation = await consultService.declineConsultation({
      expertId: req.user?.id,
      consultationId: req.params.consultationId,
      reason: req.body.reason,
    });

    return res.json({ success: true, data: consultation });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /consultations/:consultationId/cancel — participant only.
 */
export async function cancel(req, res, next) {
  try {
    const consultation = await consultService.cancelConsultation({
      userId: req.user?.id,
      role: req.role,
      roles: req.roles,
      consultationId: req.params.consultationId,
      reason: req.body.reason,
    });

    return res.json({ success: true, data: consultation });
  } catch (error) {
    next(error);
  }
}


// ---------------------------------------------------------------------------
// Video session
// ---------------------------------------------------------------------------

/**
 * GET /consultations/:consultationId/session — room state + Chime credentials.
 */
export async function getSession(req, res, next) {
  try {
    const data = await consultService.getSessionConfig({
      consultationId: req.params.consultationId,
      userId: req.user?.id,
      role: req.role,
      roles: req.roles,
    });

    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /consultations/:consultationId/join — the dedicated consult portal's
 * single entry point.
 *
 * Reuses the same authorization + Chime session machinery as `getSession`
 * (participant check, pay-at-the-door gate, attendee creation) but returns
 * only what a live-session page needs: the role the backend resolved from
 * the token (never trusted from the URL) and the meeting/attendee pair for
 * the browser SDK. Unpaid users get `paymentRequired` and the amount — the
 * payment itself stays in the client portal; no room keys ever leave here.
 */
export async function join(req, res, next) {
  try {
    const data = await consultService.getSessionConfig({
      consultationId: req.params.consultationId,
      userId: req.user?.id,
      role: req.role,
      roles: req.roles,
    });

    const paymentRequired = Boolean(data.paymentRequired);

    return res.json({
      success: true,
      data: {
        consultationId: data.consultationId,
        role: data.side,
        status: data.status,
        userName: data.userName,
        expertName: data.expertName,
        paymentRequired,
        ...(paymentRequired
          ? { amount: data.amount, currency: data.currency }
          : {}),
        // The browser SDK needs the FULL meeting response (MediaPlacement —
        // AudioHostUrl, signaling URLs, …) to build its connection; this
        // object is designed to be handed to clients. The attendee carries
        // the caller's JoinToken — still never in a URL.
        ...(data.chime
          ? {
              meeting: data.chime.meeting,
              attendee: data.chime.attendee,
            }
          : {}),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /consultations/:consultationId/session/join
 */
export async function joinSession(req, res, next) {
  try {
    const data = await consultService.joinSession({
      consultationId: req.params.consultationId,
      userId: req.user?.id,
      role: req.role,
      roles: req.roles,
    });

    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /consultations/:consultationId/session/heartbeat
 */
export async function heartbeat(req, res, next) {
  try {
    const data = await consultService.heartbeat({
      consultationId: req.params.consultationId,
      userId: req.user?.id,
      role: req.role,
      roles: req.roles,
    });

    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /consultations/:consultationId/session/end
 */
export async function endSession(req, res, next) {
  try {
    const data = await consultService.endSession({
      consultationId: req.params.consultationId,
      userId: req.user?.id,
      role: req.role,
      roles: req.roles,
      reason: req.body?.reason,
    });

    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Cross-subdomain session handoff
// ---------------------------------------------------------------------------

/**
 * POST /consultations/handoff — the client/expert portals trade their own
 * (still valid) bearer token for a one-time, short-lived ticket they can
 * open the consultation room with. Part of consultations (not auth): it
 * exists only to move an existing session onto the room portal.
 */
export async function createHandoff(req, res, next) {
  try {
    // The portal's own bearer token (header) proves who is asking — never
    // an id from the body. A body token is accepted for callers whose HTTP
    // client doesn't attach headers automatically.
    const token =
      req.body?.token ||
      (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

    const { code } = await consultService.createHandoffTicket({
      token,
    });

    return res.json({ success: true, data: { code } });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /consultations/handoff/exchange — the consultations portal swaps a
 * handoff ticket for a regular JWT, indistinguishable from a normal login
 * token.
 */
export async function exchangeHandoff(req, res, next) {
  try {
    const { token, role } = await consultService.exchangeHandoffTicket({
      code: req.body?.code,
    });

    return res.json({ success: true, data: { token, role } });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

/**
 * POST /consultations/:consultationId/rating — participating user, once only.
 */
export async function rate(req, res, next) {
  try {
    const consultation = await consultService.rateConsultation({
      userId: req.user?.id,
      consultationId: req.params.consultationId,
      score: req.body.score,
      review: req.body.review,
    });

    return res.json({ success: true, data: consultation });
  } catch (error) {
    next(error);
  }
}
