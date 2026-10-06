import { provision, startCluster, stopCluster } from "../scripts/local-pg.mjs";
import { runMigrations } from "../src/db/migrate";

const PORT = 54329;

/** Boots a throwaway Postgres for the test run, applies migrations, and tears it down afterwards. */
export default async function setup() {
  const info = await startCluster("test", PORT, { fresh: true });
  await provision(info, { database: "freight_test", appRole: "freight_app", appPassword: "freight_app" });
  await runMigrations(`postgres://postgres@127.0.0.1:${PORT}/freight_test`);
  return async () => {
    stopCluster("test", PORT);
  };
}
