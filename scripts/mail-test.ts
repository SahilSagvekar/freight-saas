/**
 * Sends ONE test email over SMTP and prints exactly what the mail server answers, so you can fix email
 * from your own computer without redeploying. Uses the same settings as the live app.
 *
 *   Git Bash:  export SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=you@gmail.com SMTP_PASS="app password"
 *              export MAIL_FROM="Harborline <you@gmail.com>"
 *              npm run mail:test -- --to you@example.com
 * 
 *
 * It sends a real email, so use your own address. The password is never printed.
 */
import { parseArgs } from "node:util";
import { smtpTransport } from "@/server/mail";

const hintFor = (message: string): string | null => {
  if (/535|auth|credentials|username and password/i.test(message)) return "The server rejected the login. Check SMTP_USER and SMTP_PASS. Gmail and most providers need an app password, not your normal password.";
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) return "SMTP_HOST could not be found. Check the spelling.";
  if (/ECONNREFUSED|ETIMEDOUT|timeout|ESOCKET/i.test(message)) return "Could not connect. Check SMTP_PORT (587 for most, 465 for SSL) and that your network allows outgoing mail.";
  if (/wrong version number|SSL|TLS/i.test(message)) return "Encryption mismatch. Use port 465 with SMTP_SECURE=true, or port 587 with SMTP_SECURE=false.";
  if (/sender|from|553|550|relay/i.test(message)) return "The server refused the sender. MAIL_FROM usually must be the same address you log in with, or one your provider allows.";
  return null;
};

async function main() {
  const { values } = parseArgs({ options: { to: { type: "string" } } });
  const to = values.to?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("\nRequired: --to you@example.com  (use your own address; a real email is sent)\n");
    process.exit(1);
  }
  if (!process.env.SMTP_HOST) {
    console.error("\nSMTP_HOST is not set in this terminal, for example: smtp.gmail.com\n");
    process.exit(1);
  }
  const from = process.env.MAIL_FROM;
  if (!from) {
    console.error('\nMAIL_FROM is not set in this terminal, for example: Harborline <you@gmail.com>\n');
    process.exit(1);
  }
  console.log(`\nSending a test email\n  server: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}\n  from:   ${from}\n  to:     ${to}\n`);
  const info = await smtpTransport().sendMail({ from, to, subject: "Harborline test email", text: "If you can read this, Harborline can send email. You can delete it." });
  console.log(`Accepted by the mail server. Check the inbox and the spam folder.\n${info.response}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nThe mail server refused or could not be reached: ${message}\n`);
  const hint = hintFor(message);
  if (hint) console.error(`${hint}\n`);
  process.exit(1);
});
