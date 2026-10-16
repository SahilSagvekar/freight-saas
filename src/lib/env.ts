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
  return problems;
}
