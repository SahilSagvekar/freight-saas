import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: "postgres://freight_app:freight_app@127.0.0.1:54329/freight_test",
      ADMIN_DATABASE_URL: "postgres://postgres@127.0.0.1:54329/freight_test",
      SESSION_SECRET: "test-secret-test-secret-test-secret-123",
    },
  },
});
