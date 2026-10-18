/**
 * Sends ONE test email through Resend and prints exactly what Resend answers, so you can fix email
 * from your own computer without redeploying. Uses the same two settings as the live app.
 *
 *   PowerShell:  $env:RESEND_API_KEY = "re_..."; $env:MAIL_FROM = "Harborline <hello@yourdomain.com>"
 *                npm run mail:test -- --to you@example.com
 *
 * It sends a real email, so use your own address. The API key is never printed.
 */
import { parseArgs } from "node:util";

const HINTS: Record<number, string> = {
  401: "Resend does not accept this API key. Create a new one in Resend (API Keys) and check it belongs to the same team as your domain.",
  403: "Resend refused the sender or the recipient. Usually the MAIL_FROM domain is not verified in Resend (Domains page), or you are still on Resend's test sender, which only delivers to your own account's email.",
  422: "Resend rejected the request format. MAIL_FROM must look like: Harborline <hello@yourdomain.com>",
  429: "Too many requests. Wait a minute and try again.",
};

async function main() {
  const { values } = parseArgs({ options: { to: { type: "string" } } });
  const to = values.to?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error('\nRequired: --to you@example.com  (use your own address; a real email is sent)\n');
    process.exit(1);
  }
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key) {
    console.error("\nRESEND_API_KEY is not set in this terminal.\n");
    process.exit(1);
  }
  if (!from) {
    console.error('\nMAIL_FROM is not set in this terminal, for example: Harborline <hello@yourdomain.com>\n');
    process.exit(1);
  }

  console.log(`\nSending a test email\n  from: ${from}\n  to:   ${to}\n`);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Harborline test email",
      text: "If you can read this, Harborline can send email. You can delete it.",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.text();

  if (res.ok) {
    console.log(`Accepted by Resend (${res.status}). Check the inbox and the spam folder, and Resend's Emails page.\n${body}\n`);
    return;
  }
  console.error(`Refused by Resend (${res.status}).\n${body}\n`);
  const hint = HINTS[res.status];
  if (hint) console.error(`${hint}\n`);
  process.exit(1);
}

main().catch((error) => {
  console.error(`\nCould not reach Resend: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
