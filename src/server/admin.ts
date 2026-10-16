import { adminDb } from "@/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { notFound } from "next/navigation";
import { getAuth } from "./auth";

/** For /admin pages and actions. Anyone else gets a plain 404, so the console's existence isn't advertised. */
export async function requirePlatformAdmin() {
  const auth = await getAuth();
  if (!auth || !isPlatformAdmin(auth.email)) notFound();
  return auth;
}

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  billingStatus: string;
  trialEndsAt: Date | null;
  createdAt: Date;
  people: number;
  vessels: number;
  bookings: number;
  lastBookingAt: Date | null;
};

export async function listTenants(): Promise<TenantRow[]> {
  const rows = await adminDb().$queryRaw<(Omit<TenantRow, "people" | "vessels" | "bookings"> & { people: bigint; vessels: bigint; bookings: bigint })[]>`
    select t.id, t.name, t.slug, t.status, t.plan, t.billing_status as "billingStatus", t.trial_ends_at as "trialEndsAt", t.created_at as "createdAt",
      (select count(*) from memberships m where m.tenant_id = t.id and m.status = 'active') as people,
      (select count(*) from vessels v where v.tenant_id = t.id and v.active) as vessels,
      (select count(*) from bookings b where b.tenant_id = t.id) as bookings,
      (select max(b.created_at) from bookings b where b.tenant_id = t.id) as "lastBookingAt"
    from tenants t order by t.created_at desc limit 500`;
  return rows.map((r) => ({ ...r, people: Number(r.people), vessels: Number(r.vessels), bookings: Number(r.bookings) }));
}

export async function logAdminAction(actorId: string, tenantId: string, action: string, after?: unknown) {
  await adminDb().auditLog.create({ data: { tenantId, actorId, action: `admin.${action}`, entity: "tenant", entityId: tenantId, after: after === undefined ? undefined : JSON.parse(JSON.stringify(after)) } });
}
