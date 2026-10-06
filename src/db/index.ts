import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * Two connections, on purpose:
 *  - app:   a role without BYPASSRLS. Every tenant query runs through withTenant(), which pins the
 *           tenant for the transaction so row-level security can enforce isolation.
 *  - admin: the table owner. Used only for login lookups, tenant provisioning and migrations.
 */
const LOCAL_APP_URL = "postgres://freight_app:freight_app@127.0.0.1:54320/freight";
const LOCAL_ADMIN_URL = "postgres://postgres@127.0.0.1:54320/freight";

type Handles = { app?: PrismaClient; admin?: PrismaClient };

// Cached on globalThis so Next.js hot reloads do not open a new pool every time.
const g = globalThis as unknown as { __freightDb?: Handles };
const handles: Handles = (g.__freightDb ??= {});

function url(envName: "DATABASE_URL" | "ADMIN_DATABASE_URL", fallback: string): string {
  const value = process.env[envName];
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error(`${envName} is required in production`);
  return fallback;
}

function connect(connectionString: string, max: number) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
}

export function appDb(): PrismaClient {
  return (handles.app ??= connect(url("DATABASE_URL", LOCAL_APP_URL), 10));
}

export function adminDb(): PrismaClient {
  return (handles.admin ??= connect(url("ADMIN_DATABASE_URL", LOCAL_ADMIN_URL), 4));
}

export async function closeDb() {
  await handles.app?.$disconnect();
  await handles.admin?.$disconnect();
  handles.app = undefined;
  handles.admin = undefined;
}

/** The client handed to code running inside a transaction. */
export type Tx = Prisma.TransactionClient;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Interactive transactions default to a 5s limit, which the seed script and big syncs can exceed.
const TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

/**
 * Runs `fn` in a transaction scoped to one tenant. All tenant data access goes through here.
 * The tenant is set with set_config(..., true), so it lasts for this transaction only and can never
 * leak onto another request that reuses the pooled connection.
 */
export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(tenantId)) throw new Error("withTenant: invalid tenant id");
  return appDb().$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  }, TX_OPTIONS);
}

/** Same as the admin client's $transaction, with the longer limits. */
export function adminTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return adminDb().$transaction(fn, TX_OPTIONS);
}

const LOCKABLE = { voyages: "voyages", bookings: "bookings", invoices: "invoices", manifest_entries: "manifest_entries" } as const;

/** `select ... for update` on one row. Prisma has no row-lock API, so locking is a raw query; the caller then reads the row normally. */
export async function lockRow(tx: Tx, table: keyof typeof LOCKABLE, id: string): Promise<void> {
  await tx.$queryRaw`select id from ${Prisma.raw(`"${LOCKABLE[table]}"`)} where id = ${id}::uuid for update`;
}

/** A Postgres unique-violation, however Prisma surfaced it. */
export function isUniqueViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2002";
  const code = (e: unknown) => (typeof e === "object" && e && "code" in e ? (e as { code?: unknown }).code : undefined);
  return code(error) === "23505" || code((error as { cause?: unknown } | null)?.cause) === "23505";
}
