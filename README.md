# Harborline

Booking and manifest software for ferry and freight operators. Passengers, vehicles and cargo on one
booking; configurable item types, prices and taxes per operator; a ticket desk that keeps working offline.

## Run it locally

```bash
npm install
npm run db:start      # embedded Postgres on :54320 (data in .pgdata)
npm run db:migrate    # prisma migrate deploy + app-role grants
npm run seed          # demo operator: demo@harborline.test / demo-password-1
npm run dev           # http://localhost:3000
```

## Checks

```bash
npm test              # 49 tests against a throwaway Postgres (isolation, bookings, sync, auth)
npm run typecheck && npm run lint && npm run build
```

## How it is built

- **Multi-tenant**: one database, `tenant_id` on every table, enforced by Postgres row-level security.
  The app connects as a role that cannot bypass it; `withTenant()` pins the operator per transaction.
- **Data access** is Prisma (`prisma/schema.prisma`). RLS policies, the `lower(email)` index and the app role's
  column grants can't be expressed in Prisma, so they live as raw SQL in `prisma/migrations/0_init` and
  `src/db/migrate.ts`. After changing the schema: `npx prisma migrate dev --create-only`, then hand-add SQL
  for any new tenant table (`ENABLE ROW LEVEL SECURITY` + a `*_tenant_isolation` policy).
- **Money** is integer minor units plus a currency code. Tax is basis points, inclusive or exclusive.
- **Capacity** is checked under a row lock on the voyage, so concurrent sales cannot oversell online.
- **Offline**: the ticket desk (`/app/desk`) queues sales in IndexedDB and uploads them to `/api/sync`.
  Each sale carries an id, so retries never double-book. Sales that clash with live data (sailing filled up,
  price changed) are kept and flagged for staff in the Review queue.
- **Auth**: signed session cookie; permissions are re-read from the database on every request.

## Before going live

Set the three variables in `.env.example`, run migrations with the owner connection, and put the app
behind HTTPS. Not built yet: online payments, a customer-facing booking page, email/SMS, refunds,
team and role management screens (the data model supports them).
# freight-saas
