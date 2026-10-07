import {
  ChimeSDKMeetingsClient,
  CreateAttendeeCommand,
  CreateMeetingCommand,
  DeleteMeetingCommand,
} from "@aws-sdk/client-chime-sdk-meetings";

import Consultation from "../models/Consultation.js";
import config from "../config/index.js";
import { logger } from "./logger.service.js";

/**
 * Amazon Chime SDK meeting backend.
 *
 * The backend is the only AWS-aware component: it creates a Meeting (the
 * media plane, fully managed by AWS) and one Attendee per participant, then
 * hands both response objects to the browser SDK, which connects directly.
 * All the offer/answer/ICE relay code this replaces simply disappears.
 *
 * Persistence: the meeting and each attendee are stored on the consultation
 * document so re-joins (refresh, reconnect) reuse the same resources —
 * CreateMeeting/CreateAttendee are billed per resource, not per call.
 *
 * Credentials come from the consolidated `aws` config (standard
 * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars); the meeting's media
 * region defaults to Mumbai.
 */

let client = null;

function chime() {
  if (!client) {
    // Static keys only when both are present (e.g. local .env). Otherwise
    // defer to the AWS SDK's default credential chain — on Lambda that is
    // the execution role, the recommended setup for production.
    const hasStaticKeys = Boolean(
      config.aws.accessKeyId && config.aws.secretAccessKey,
    );
    client = new ChimeSDKMeetingsClient({
      region: config.aws.region,
      ...(hasStaticKeys
        ? {
            credentials: {
              accessKeyId: config.aws.accessKeyId,
              secretAccessKey: config.aws.secretAccessKey,
              ...(config.aws.sessionToken
                ? { sessionToken: config.aws.sessionToken }
                : {}),
            },
          }
        : {}),
    });
  }
  return client;
}

const attendeeField = (side) => (side === "user" ? "userAttendee" : "expertAttendee");

/**
 * Returns { meeting, attendee } for a participant, creating the meeting and
 * the participant's attendee on first use and reusing them afterwards.
 */
export async function ensureChimeSession(consultation, side, userId) {
  const existing = consultation.chime || {};

  let meeting = existing.meetingResponse;
  if (!meeting || !existing.meetingId) {
    const { Meeting } = await chime().send(
      new CreateMeetingCommand({
        // Idempotency token: a retry can never double-bill a meeting.
        ClientRequestToken: String(consultation.id || consultation._id),
        ExternalMeetingId: String(consultation.id || consultation._id),
        MediaRegion: config.aws.chime.mediaRegion,
      }),
    );
    meeting = Meeting;

    await Consultation.updateOne(
      { _id: consultation._id },
      {
        $set: {
          "chime.meetingId": Meeting.MeetingId,
          "chime.mediaRegion": Meeting.MediaRegion,
          "chime.meetingResponse": Meeting,
        },
      },
    );

    logger.info("Chime meeting created", {
      consultationId: consultation.id,
      meetingId: Meeting.MeetingId,
      mediaRegion: Meeting.MediaRegion,
    });
  }

  const field = attendeeField(side);
  let attendee = existing[field];
  if (!attendee || !attendee.JoinToken) {
    const { Attendee } = await chime().send(
      new CreateAttendeeCommand({
        MeetingId: meeting.MeetingId,
        ExternalUserId: `${side}-${userId}`,
      }),
    );
    attendee = Attendee;

    await Consultation.updateOne(
      { _id: consultation._id },
      { $set: { [`chime.${field}`]: Attendee } },
    );
  }

  return { meeting, attendee };
}

/**
 * Tears down the AWS meeting (its attendees go with it). Called when the
 * session ends — completion, cancellation or the stale sweep. Missing or
 * already-deleted meetings are ignored so cleanup stays idempotent.
 */
export async function deleteChimeMeeting(consultation) {
  const meetingId = consultation.chime?.meetingId;
  if (!meetingId) return;

  try {
    await chime().send(new DeleteMeetingCommand({ MeetingId: meetingId }));
    await Consultation.updateOne(
      { _id: consultation._id },
      { $unset: { chime: "" } },
    );
    logger.info("Chime meeting deleted", { consultationId: consultation.id, meetingId });
  } catch (err) {
    // The meeting may already be gone — never let cleanup fail the flow.
    logger.warn("Chime meeting cleanup failed", {
      consultationId: consultation.id,
      meetingId,
      error: err?.message,
    });
  }
}
