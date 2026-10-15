import { layout } from "./layout.js";

/** Sent to the expert when a client books — asks them to confirm or reject. */
export function bookingRequestedEmail({
  expertName,
  clientName,
  clientEmail,
  problem,
}) {
  return {
    subject: "New consultation request on LifeBookz",
    html: layout({
      preheader: `${clientName || "A client"} requested a session with you.`,
      heading: `New request from ${clientName || "a client"}`,
      body: `
        <p style="margin:0">Hi ${expertName || "there"}, a client has requested a consultation with you.</p>
        <p style="margin:16px 0 0">What they need help with: ${problem || "No details provided."}</p>
        <p style="margin:16px 0 0">Please open your dashboard to confirm or reject this booking.</p>
      `,
    }),
  };
}

/** Sent to the client after the expert confirms or rejects. */
export function bookingStatusEmail({
  clientName,
  expertName,
  status,
  roomUrl,
  bookingsUrl,
  amountLabel,
  reason,
}) {
  if (status === "confirmed") {
    return {
      subject: "Your consultation is confirmed",
      html: layout({
        preheader: "Your session is confirmed — join the room to start.",
        heading: `Hi ${clientName || "there"}, you're confirmed!`,
        body: `
          <p style="margin:0">${expertName || "Your expert"} has confirmed your consultation session.</p>
          ${amountLabel ? `<p style="margin:12px 0 0">Session fee: ${amountLabel} — you'll complete the payment when you enter the room.</p>` : ""}
          <p style="margin:12px 0 0">${roomUrl ? `Open the room at: ${roomUrl}. ` : ""}The session starts as soon as you've paid and joined.</p>
        `,
      }),
    };
  }

  if (status === "completed") {
    return {
      subject: "Your consultation is complete — share your experience",
      html: layout({
        preheader: "Your session has ended. Tell us how it went.",
        heading: `Hi ${clientName || "there"}, how was your session?`,
        body: `
          <p style="margin:0">Your session with ${expertName || "your expert"} has ended.</p>
          <p style="margin:12px 0 0">Take a moment to rate the session and share your experience — it helps other people choose well and helps your expert grow.${bookingsUrl ? ` You can rate it at: ${bookingsUrl}.` : ""}</p>
        `,
      }),
    };
  }

  // Cancelled / rejected
  return {
    subject: "Your consultation was cancelled",
    html: layout({
      preheader: "This consultation has been cancelled.",
      heading: `Hi ${clientName || "there"}`,
      body: `
        <p style="margin:0">Your consultation with ${expertName || "your expert"} has been cancelled.</p>
        ${reason ? `<p style="margin:12px 0 0">Reason: ${reason}</p>` : ""}
        <p style="margin:12px 0 0">You can request a session with another expert any time.</p>
      `,
    }),
  };
}
