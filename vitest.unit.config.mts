import path from "node:path";
import { defineConfig } from "vitest/config";

// The tests that need no database: pure logic only, so they start instantly and run anywhere (`npm run test:unit`).
// `npm test` still runs everything, including these, against a throwaway Postgres.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit.test.ts", "tests/live-safety.test.ts", "tests/portals.test.ts","tests/ops.test.ts", "tests/freight-unit.test.ts"],
    env: { SESSION_SECRET: "test-secret-test-secret-test-secret-123" },
  },
});
