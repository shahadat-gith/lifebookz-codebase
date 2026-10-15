import { layout } from "./layout.js";

/**
 * One-time password mail for password resets.
 *
 * Plain text — the code is the whole message, shown large and spaced out so
 * it is easy to read on a phone and easy to copy on a desktop.
 */
export function otpEmail({ otp, role = "user" }) {
  const subject =
    role === "user"
      ? "LifeBookz - Password Reset OTP"
      : `LifeBookz - ${role[0].toUpperCase()}${role.slice(1)} Password Reset OTP`;

  return {
    subject,
    html: layout({
      preheader: `Your LifeBookz password reset code is ${otp}.`,
      heading: "Reset your password",
      body: `
        <p style="margin:0">Use the code below to reset the password on your LifeBookz ${role} account.</p>
        <p style="margin:24px 0;font-size:28px;font-weight:700;letter-spacing:8px;color:#111111">${otp}</p>
        <p style="margin:0">This code is valid for 10 minutes and can be used once.</p>
        <p style="margin:16px 0 0">If you didn't request this, you can safely ignore this email — your password stays unchanged.</p>
      `,
    }),
  };
}
