# Harborline

Booking and manifest software for ferry and freight operators. Passengers, vehicles and cargo on one
booking; configurable item types, prices and taxes per operator; a ticket desk that keeps working offline.

## Run it locally

```bash
npm install
npm run db:start      # embedded Postgres on :54320 (data in .pgdata)
npm run db:migrate    # prisma migrate deploy + app-role grants
npm run seed          # DEMO operator with fake data, local use only: demo@harborline.test / demo-password-1
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

## Going live

Production and the demo are two separate deployments with two separate databases. Production never holds demo
data, demo logins or placeholder prices.

1. Set the variables in `.env.example` (`DATABASE_URL`, `ADMIN_DATABASE_URL`, `SESSION_SECRET`, `APP_URL`),
   run `npm run db:migrate` with the owner connection, and put the app behind HTTPS.
2. Create each customer with `npm run tenant:create -- --name "Island Ferries" --owner-name "Maya Collins" --email maya@example.com --currency USD --timezone America/Nassau`.
   It prints a one-time link (valid 72 hours, works once). The owner opens it and chooses their own password.
   No password is ever chosen or stored by you, and no price list is added unless you pass `--starter`.
3. The owner signs in, follows the setup checklist on their home page (ports, vessels, prices, first voyage),
   then adds staff under **Team**. Each new member gets their own one-time link.

The demo (`npm run seed`) refuses to run on any database that holds a real operator, and on a non-local database
unless `ALLOW_DEMO_SEED=this-is-the-demo-database` is set. Tests refuse to connect to anything except the local
`freight_test` database.

Not built yet: online payments, a customer-facing booking page, email/SMS (until then, links are handed over by
you or the owner), refunds, and a custom role editor.
# freight-saas
