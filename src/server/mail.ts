import nodemailer, { type Transporter } from "nodemailer";
import type { Email } from "@/lib/email-templates";

/** Email is optional: without SMTP_HOST and MAIL_FROM nothing is sent, and callers show the link on screen instead. */
export const mailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);

/** One connection setup for the app and for `npm run mail:test`, so what the test proves is what the app does. */
export function smtpTransport(): Transporter {
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Port 465 is encrypted from the first byte; 587 and 25 start plain and upgrade (STARTTLS). SMTP_SECURE overrides.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
}

/** Returns true only when the SMTP server accepted the message. Never throws, so an email outage can't break a signup. */
export async function sendMail(to: string, email: Email): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    await smtpTransport().sendMail({ from: process.env.MAIL_FROM, to, subject: email.subject, text: email.text, html: email.html });
    return true;
  } catch (e) {
    // The server's reply says why (bad login, blocked sender). It never contains the password.
    console.error("mail: send failed", e instanceof Error ? e.message : e);
    return false;
  }
}
