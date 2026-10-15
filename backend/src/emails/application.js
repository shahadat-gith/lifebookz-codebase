import { layout } from "./layout.js";

/**
 * Mails for the author / expert upgrade-request lifecycle.
 *
 * One upgrade request can only be reviewed by an admin, so the three mails
 * follow one conversation:
 *   1. submitted — the request reached the admin; what approval unlocks.
 *   2. approved  — the account can now use its new role.
 *   3. rejected  — an update, with reason, and how to reapply.
 * Plain text only — no buttons or links.
 */
const ROLES = {
  author: {
    label: "author",
    submittedBlurb:
      "Once an admin approves your request, you will be able to write lifebooks, publish stories and connect with readers.",
    approvedBlurb:
      "Your author request has been approved and your account is now active. You can create your lifebook, publish stories and connect with readers.",
  },
  expert: {
    label: "expert",
    submittedBlurb:
      "Once an admin approves your request, you will be able to receive consultation sessions and manage them from your dashboard.",
    approvedBlurb:
      "Your expert request has been approved and your account is now active. You can receive consultation bookings and manage your sessions from your dashboard.",
  },
};

function presetFor(role) {
  return ROLES[role] ?? ROLES.author;
}

export function applicationSubmittedEmail({ name, role }) {
  const preset = presetFor(role);

  return {
    subject: `Your ${preset.label} upgrade request has been submitted`,
    html: layout({
      preheader: "Your upgrade request has been sent to the admin for review.",
      heading: `Thanks, ${name || "there"}`,
      body: `
        <p style="margin:0">Your LifeBookz ${preset.label} upgrade request has been sent to the admin and is under review.</p>
        <p style="margin:16px 0 0">${preset.submittedBlurb}</p>
        <p style="margin:16px 0 0">Please wait for approval — we will email you as soon as there is an update.</p>
      `,
    }),
  };
}

export function applicationApprovedEmail({ name, role }) {
  const preset = presetFor(role);

  return {
    subject: `Your LifeBookz ${preset.label} request has been approved`,
    html: layout({
      preheader: "Your request has been approved.",
      heading: `Congratulations, ${name || "there"}`,
      body: `
        <p style="margin:0">${preset.approvedBlurb}</p>
        <p style="margin:16px 0 0">You can sign in with your existing account details and start right away.</p>
      `,
    }),
  };
}

export function applicationRejectedEmail({ name, role, reason }) {
  const preset = presetFor(role);

  return {
    subject: `Update on your LifeBookz ${preset.label} request`,
    html: layout({
      preheader: "An update on your upgrade request.",
      heading: `Hi ${name || "there"}`,
      body: `
        <p style="margin:0">After reviewing your LifeBookz ${preset.label} request, the admin was unable to approve it at this time.</p>
        <p style="margin:16px 0 0">Reason: ${reason || "No specific reason was provided."}</p>
        <p style="margin:16px 0 0">You are welcome to update your details and apply again in the future. If you believe this was a mistake, reply to this email and the team will take another look.</p>
      `,
    }),
  };
}
