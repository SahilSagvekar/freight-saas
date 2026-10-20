import { totpSecretProblem } from "./totp";

/** Problems with the environment that would make a live deployment unsafe or broken. Empty means fine. */
export function productionEnvProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  if (!env.DATABASE_URL) problems.push("DATABASE_URL is not set");
  if (!env.ADMIN_DATABASE_URL) problems.push("ADMIN_DATABASE_URL is not set");
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) problems.push("SESSION_SECRET must be at least 32 characters");
  if (!env.APP_URL) problems.push("APP_URL is not set (links in emails would be wrong)");
  else if (!/^https:\/\//.test(env.APP_URL)) problems.push("APP_URL must start with https://");
  if (env.DATABASE_URL && env.DATABASE_URL === env.ADMIN_DATABASE_URL) {
    problems.push("DATABASE_URL and ADMIN_DATABASE_URL are the same: the app would run as the owner and skip row-level security");
  }
  // Half a CAPTCHA setup silently turns the check off (the form hides the box, the server skips the check). Both or neither.
  if (Boolean(env.TURNSTILE_SITE_KEY) !== Boolean(env.TURNSTILE_SECRET_KEY)) {
    problems.push("TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be set together (or both left out)");
  }
  // Listing platform admins without a working second factor would leave the console shut with no hint why.
  if (env.PLATFORM_ADMIN_EMAILS?.trim()) {
    const problem = totpSecretProblem(env.PLATFORM_ADMIN_TOTP_SECRET?.trim());
    if (problem) problems.push(`PLATFORM_ADMIN_EMAILS is set, so the admin console needs two-factor: ${problem} (create one with npm run admin:2fa)`);
  }
  return problems;
}
