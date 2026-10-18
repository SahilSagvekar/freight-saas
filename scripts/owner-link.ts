/**
 * Prints a fresh one-time sign-in link for an EXISTING user, for when the email never arrived or the link expired.
 * The person opens it and chooses a new password. Nothing is changed until they do.
 *
 *   npm run owner:link -- --email maya@example.com
 *
 * Needs ADMIN_DATABASE_URL, SESSION_SECRET (the same value the live app uses) and APP_URL (the live site's address).
 */
import { parseArgs } from "node:util";
import { adminDb, closeDb, LOCAL_ADMIN_URL } from "@/db";
import { isLocalDatabase } from "@/lib/live-guard";
import { SETUP_LINK_TTL_HOURS } from "@/lib/tokens";
import { issueSetupLink } from "@/server/setup-links";

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, "app-url": { type: "string" } } });

  const email = values.email?.trim().toLowerCase();
  if (!email) fail("Required: --email person@example.com");

  const adminUrl = process.env.ADMIN_DATABASE_URL ?? LOCAL_ADMIN_URL;
  const local = isLocalDatabase(adminUrl);
  const secret = process.env.SESSION_SECRET;
  if (!(secret && secret.length >= 32) && !local) {
    fail("Set SESSION_SECRET (at least 32 characters, the same value the live app uses) so the link verifies on the live site.");
  }
  const appUrl = values["app-url"] ?? process.env.APP_URL ?? "http://localhost:3000";
  if (!local && /localhost|127\.0\.0\.1/.test(appUrl)) fail("Set APP_URL (or pass --app-url) to the live site's address, for example https://app.example.com");

  const found = await adminDb().$queryRaw<{ id: string; name: string }[]>`select id, name from users where lower(email) = ${email}`;
  const user = found[0];
  if (!user) fail(`No account uses ${email}. Check the spelling, or create one with: npm run tenant:create`);

  const link = await issueSetupLink(user.id, appUrl);
  console.log(`\nFresh link for ${user.name} <${email}>. Send it to them. It works once and expires in ${SETUP_LINK_TTL_HOURS} hours:\n`);
  console.log(`  ${link}\n`);
}

main().then(closeDb, (error) => {
  console.error(error instanceof Error ? error.message : error);
  return closeDb().then(() => process.exit(1));
});
