import { sendEmailSafely } from "../services/email.service.js";
import {
  applicationApprovedEmail,
  applicationRejectedEmail,
  applicationSubmittedEmail,
} from "../emails/index.js";

/**
 * Sent the moment an upgrade request reaches the admin — tells the user the
 * request is waiting for approval and what it unlocks once approved.
 */
export async function sendApplicationSubmitted(email, name, role = "author") {
  const { subject, html } = applicationSubmittedEmail({ name, role });

  await sendEmailSafely({ to: email, subject, html });
}

export async function sendApplicationApproved(email, name, role = "author") {
  const { subject, html } = applicationApprovedEmail({ name, role });

  await sendEmailSafely({ to: email, subject, html });
}

export async function sendApplicationRejected(email, name, reason, role = "author") {
  const { subject, html } = applicationRejectedEmail({ name, role, reason });

  await sendEmailSafely({ to: email, subject, html });
}
