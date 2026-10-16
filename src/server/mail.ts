import type { Email } from "@/lib/email-templates";

/** Email is optional: without RESEND_API_KEY and MAIL_FROM nothing is sent, and callers show the link on screen instead. */
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

/** Returns true only when the provider accepted the message. Never throws, so an email outage can't break a signup. */
export async function sendMail(to: string, email: Email): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject: email.subject, text: email.text, html: email.html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("mail: provider refused", res.status);
    return res.ok;
  } catch (e) {
    console.error("mail: send failed", e);
    return false;
  }
}
