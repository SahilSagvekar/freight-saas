import { execFileSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";

/**
 * Applies Prisma migrations as the table owner, then (re)applies the app role's privileges.
 * The app role gets plain data access plus column-level limits; row-level security does the isolation.
 */
export async function runMigrations(adminUrl: string, appRole = "freight_app") {
  const cli = path.resolve(process.cwd(), "node_modules/prisma/build/index.js");
  execFileSync(process.execPath, [cli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, ADMIN_DATABASE_URL: adminUrl },
    stdio: "pipe",
  });

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const role = `"${appRole.replace(/"/g, '""')}"`;
    await client.query(`grant usage on schema public to ${role}`);
    await client.query(`grant select, insert, update, delete on all tables in schema public to ${role}`);

    // Users are managed by the platform (admin connection), never by tenant code.
    await client.query(`revoke all on table users from ${role}`);
    await client.query(`grant select (id, email, name, phone, created_at) on table users to ${role}`);

    // Tenants are provisioned by the platform; a tenant may edit only its own display settings.
    await client.query(`revoke all on table tenants from ${role}`);
    await client.query(`grant select on table tenants to ${role}`);
    await client.query(`grant update (name, locale, time_zone) on table tenants to ${role}`);
  } finally {
    await client.end();
  }
}

// CLI: npm run db:migrate
const invokedDirectly = process.argv[1]?.endsWith("migrate.ts");
if (invokedDirectly) {
  const adminUrl = process.env.ADMIN_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54320/freight";
  runMigrations(adminUrl)
    .then(() => console.log("Migrations applied"))
    .catch((error) => {
      console.error(error.stderr?.toString() || error);
      process.exit(1);
    });
}
