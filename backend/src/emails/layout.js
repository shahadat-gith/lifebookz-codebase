/**
 * Shared shell for every LifeBookz email.
 *
 * Deliberately plain: white background, normal text, short paragraphs, a
 * one-line signature. No cards, no brand bars, no buttons — every client
 * renders text the same way, and links live in the portal itself.
 */

export function layout({ preheader = "", heading, body }) {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#111111;font-size:14px;line-height:1.6">
    <span style="display:none;visibility:hidden;opacity:0">${preheader}</span>
    <div style="max-width:520px;margin:0 auto;padding:24px 16px">
      <h1 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111111">${heading}</h1>
      <div>${body}</div>

      <p style="margin:24px 0 0;font-size:12px;color:#777777">
        LifeBookz &middot; ${new Date().getFullYear()}
      </p>
    </div>
  </body>
</html>`;
}
