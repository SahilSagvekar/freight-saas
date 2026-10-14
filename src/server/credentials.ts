import { adminDb } from "@/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import type { SessionPayload } from "@/lib/session";

/** One operator a person may sign in to. */
export type MembershipOption = { mid: string; tid: string; tenantName: string; roleName: string };

/**
 * Checks credentials on the admin connection (login happens before any tenant is known) and returns every
 * operator the person is an active member of, oldest membership first.
 * Takes the same time for unknown emails as for wrong passwords.
 */
export async function authenticateUser(email: string, password: string): Promise<{ uid: string; memberships: MembershipOption[] } | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await adminDb().$queryRaw<
    { userId: string; passwordHash: string; membershipId: string; tenantId: string; tenantName: string; roleName: string }[]
  >`
    select u.id as "userId", u.password_hash as "passwordHash", m.id as "membershipId", m.tenant_id as "tenantId",
           t.name as "tenantName", r.name as "roleName"
    from users u
    join memberships m on m.user_id = u.id
    join tenants t on t.id = m.tenant_id
    join roles r on r.id = m.role_id
    where lower(u.email) = ${normalized} and m.status = 'active' and t.status = 'active'
    order by m.created_at asc, m.id asc`;

  const first = rows[0];
  if (!first) {
    await burnPasswordCheck(password);
    return null;
  }
  if (!(await verifyPassword(password, first.passwordHash))) return null;
  return {
    uid: first.userId,
    memberships: rows.map((r) => ({ mid: r.membershipId, tid: r.tenantId, tenantName: r.tenantName, roleName: r.roleName })),
  };
}

/** The session for someone with exactly one operator, or for their oldest one when they have several. */
export async function authenticate(email: string, password: string): Promise<SessionPayload | null> {
  const result = await authenticateUser(email, password);
  const first = result?.memberships[0];
  return result && first ? { uid: result.uid, tid: first.tid, mid: first.mid } : null;
}
