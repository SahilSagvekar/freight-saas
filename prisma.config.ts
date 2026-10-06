import { defineConfig } from "prisma/config";

// The CLI (migrate, generate) runs as the table owner. The app itself connects through src/db/index.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.ADMIN_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54320/freight" },
});
