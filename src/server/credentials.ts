import { adminDb } from "@/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import type { SessionPayload } from "@/lib/session";

/**
 * Checks credentials on the admin connection (login happens before any tenant is known).
 * Takes the same time for unknown emails as for wrong passwords.
 */
export async function authenticate(email: string, password: string): Promise<SessionPayload | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await adminDb().$queryRaw<{ userId: string; passwordHash: string; membershipId: string; tenantId: string }[]>`
    select u.id as "userId", u.password_hash as "passwordHash", m.id as "membershipId", m.tenant_id as "tenantId"
    from users u
    join memberships m on m.user_id = u.id
    join tenants t on t.id = m.tenant_id
    where lower(u.email) = ${normalized} and m.status = 'active' and t.status = 'active'
    limit 1`;

  const row = rows[0];
  if (!row) {
    await burnPasswordCheck(password);
    return null;
  }
  if (!(await verifyPassword(password, row.passwordHash))) return null;
  return { uid: row.userId, tid: row.tenantId, mid: row.membershipId };
}
