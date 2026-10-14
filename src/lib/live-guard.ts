// Guards that keep demo and test tooling away from a database that holds real operators' data.
// Pure functions, so they are easy to test and safe to import from scripts, tests and the db layer.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function hostOf(connectionString: string): string | null {
  try {
    return new URL(connectionString).hostname || null;
  } catch {
    return null;
  }
}

export function isLocalDatabase(connectionString: string): boolean {
  const host = hostOf(connectionString);
  return host !== null && LOCAL_HOSTS.has(host);
}

/** The one operator the demo seed is allowed to create. */
export const DEMO_TENANT_SLUG = "blue-lagoon-ferries";

/** Set this to seed a hosted demo database. Local databases do not need it. */
export const DEMO_SEED_FLAG = "ALLOW_DEMO_SEED";
export const DEMO_SEED_FLAG_VALUE = "this-is-the-demo-database";

/**
 * Why the demo seed must not run here, or null when it is safe.
 * Two independent checks: the database must hold no real operator, and it must be local
 * unless the person explicitly says it is the hosted demo database.
 */
export function demoSeedBlockedReason(input: {
  adminUrl: string;
  flag: string | undefined;
  existingSlugs: string[];
}): string | null {
  const real = input.existingSlugs.filter((slug) => slug !== DEMO_TENANT_SLUG);
  if (real.length > 0) {
    const shown = real.slice(0, 3).join(", ") + (real.length > 3 ? ", ..." : "");
    return `This database already holds real operators (${shown}). The demo seed only runs on an empty database or one that holds nothing but the demo operator.`;
  }
  if (!isLocalDatabase(input.adminUrl) && input.flag !== DEMO_SEED_FLAG_VALUE) {
    return `The database host (${hostOf(input.adminUrl) ?? "unknown"}) is not local. To seed a hosted demo database, set ${DEMO_SEED_FLAG}=${DEMO_SEED_FLAG_VALUE}.`;
  }
  return null;
}

/** Why tests must not connect with this connection string, or null when it is the throwaway test database. */
export function testDatabaseBlockedReason(connectionString: string | undefined): string | null {
  if (!connectionString) return "no database URL is set for the tests";
  if (!isLocalDatabase(connectionString)) {
    return `tests only run against a local throwaway Postgres (got host ${hostOf(connectionString) ?? "unknown"})`;
  }
  let database = "";
  try {
    database = new URL(connectionString).pathname.replace(/^\//, "");
  } catch {
    /* handled below */
  }
  if (database !== "freight_test") return `tests only run against a database named freight_test (got "${database}")`;
  return null;
}
