/**
 * Creates a REAL operator on whichever database the environment points to.
 * No password is chosen here: the owner gets a one-time link and picks their own.
 *
 *   npm run tenant:create -- --name "Island Ferries" --owner-name "Maya Collins" --email maya@example.com \
 *     --currency USD --timezone America/Nassau
 *
 * Add --kind freight for a freight forwarder (the default is ferry).
 *
 * Needs ADMIN_DATABASE_URL, SESSION_SECRET (the same value the live app uses) and APP_URL (the live site's address).
 */
import { parseArgs } from "node:util";
import { closeDb, LOCAL_ADMIN_URL } from "@/db";
import { isLocalDatabase } from "@/lib/live-guard";
import { provisionTenant } from "@/server/provision";
import { issueSetupLink } from "@/server/setup-links";

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      "owner-name": { type: "string" },
      email: { type: "string" },
      currency: { type: "string", default: "USD" },
      timezone: { type: "string", default: "UTC" },
      locale: { type: "string", default: "en" },
      slug: { type: "string" },
      "app-url": { type: "string" },
      starter: { type: "boolean", default: false },
      kind: { type: "string", default: "ferry" },
    },
  });

  const name = values.name?.trim();
  const ownerName = values["owner-name"]?.trim();
  const email = values.email?.trim().toLowerCase();
  if (!name || !ownerName || !email) fail('Required: --name "Company" --owner-name "Full Name" --email owner@example.com');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`"${email}" is not a valid email address.`);

  const kind = values.kind === "freight" ? "freight" : values.kind === "ferry" ? "ferry" : fail(`--kind must be "freight" or "ferry".`);
  const currency = (values.currency ?? "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail(`"${currency}" is not a 3-letter currency code.`);
  const timeZone = values.timezone ?? "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    fail(`"${timeZone}" is not a valid IANA time zone, for example America/Nassau or Asia/Kolkata.`);
  }

  const adminUrl = process.env.ADMIN_DATABASE_URL ?? LOCAL_ADMIN_URL;
  const local = isLocalDatabase(adminUrl);
  const secret = process.env.SESSION_SECRET;
  if (!(secret && secret.length >= 32) && !local) {
    fail("Set SESSION_SECRET (at least 32 characters, the same value the live app uses) so the link verifies on the live site.");
  }
  const appUrl = values["app-url"] ?? process.env.APP_URL ?? "http://localhost:3000";
  if (!local && /localhost|127\.0\.0\.1/.test(appUrl)) fail("Set APP_URL (or pass --app-url) to the live site's address, for example https://app.example.com");

  const created = await provisionTenant({
    name,
    slug: values.slug,
    baseCurrency: currency,
    locale: values.locale,
    timeZone,
    owner: { name: ownerName, email },
    workspaceKind: kind,
    starterCatalog: values.starter === true,
  });
  const link = await issueSetupLink(created.ownerUserId, appUrl);

  console.log(`\nCreated "${name}" (${created.slug}) in ${currency}, time zone ${timeZone}.`);
  console.log(`Owner: ${ownerName} <${email}>`);
  console.log("\nSend the owner this link. It works once and expires in 72 hours:\n");
  console.log(`  ${link}\n`);
  if (values.starter) console.log("A placeholder price list was added because --starter was passed.\n");
}

main().then(closeDb, (error) => {
  console.error(error instanceof Error ? error.message : error);
  return closeDb().then(() => process.exit(1));
});
