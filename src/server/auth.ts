import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { withTenant } from "@/db";
import type { Permission } from "@/lib/domain";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export type AuthContext = {
  userId: string;
  tenantId: string;
  membershipId: string;
  name: string;
  email: string;
  roleName: string;
  permissions: Set<Permission>;
  tenant: { id: string; name: string; baseCurrency: string; locale: string; timeZone: string };
};

/**
 * The signed cookie only says who the user claims to be; permissions are always re-read from the database,
 * so removing someone's access or changing their role takes effect on their very next request.
 */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const loaded = await withTenant(session.tid, async (tx) => {
    // Only columns the app role may read: users.password_hash is off limits to it.
    const membership = await tx.membership.findUnique({
      where: { id: session.mid },
      select: {
        status: true,
        userId: true,
        role: { select: { permissions: true, name: true } },
        user: { select: { name: true, email: true } },
      },
    });
    const tenant = await tx.tenant.findUnique({ where: { id: session.tid } });
    const row = membership && {
      status: membership.status,
      userId: membership.userId,
      permissions: membership.role.permissions,
      roleName: membership.role.name,
      name: membership.user.name,
      email: membership.user.email,
    };
    return row && tenant ? { row, tenant } : null;
  });

  if (!loaded || loaded.row.status !== "active" || loaded.row.userId !== session.uid || loaded.tenant.status !== "active") return null;
  return {
    userId: session.uid,
    tenantId: session.tid,
    membershipId: session.mid,
    name: loaded.row.name,
    email: loaded.row.email,
    roleName: loaded.row.roleName,
    permissions: new Set(loaded.row.permissions as Permission[]),
    tenant: {
      id: loaded.tenant.id,
      name: loaded.tenant.name,
      baseCurrency: loaded.tenant.baseCurrency,
      locale: loaded.tenant.locale,
      timeZone: loaded.tenant.timeZone,
    },
  };
});

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

export const can = (auth: AuthContext, permission: Permission) => auth.permissions.has(permission);

/** For pages: send people without the permission to a friendly explanation instead of an error. */
export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!can(auth, permission)) redirect("/app/no-access");
  return auth;
}
