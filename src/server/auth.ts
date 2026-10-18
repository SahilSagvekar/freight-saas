import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { withTenant } from "@/db";
import type { Permission, WorkspaceKind } from "@/lib/domain";
import { billingAccess, type Access, type BillingStatus } from "@/lib/billing";
import { SESSION_COOKIE, sessionStillValid, verifySessionFull } from "@/lib/session";

export type AuthContext = {
  userId: string;
  tenantId: string;
  membershipId: string;
  name: string;
  email: string;
  roleName: string;
  permissions: Set<Permission>;
  tenant: { id: string; name: string; baseCurrency: string; locale: string; timeZone: string; plan: string; billingStatus: BillingStatus; stripeAccountId: string | null; workspaceKind: WorkspaceKind };
  billing: Access;
};

/**
 * The signed cookie only says who the user claims to be; permissions are always re-read from the database,
 * so removing someone's access or changing their role takes effect on their very next request.
 */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const store = await cookies();
  const verified = await verifySessionFull(store.get(SESSION_COOKIE)?.value);
  if (!verified) return null;
  const { session, issuedAt } = verified;

  const loaded = await withTenant(session.tid, async (tx) => {
    // Only columns the app role may read: users.password_hash is off limits to it.
    const membership = await tx.membership.findUnique({
      where: { id: session.mid },
      select: {
        status: true,
        userId: true,
        role: { select: { permissions: true, name: true } },
        user: { select: { name: true, email: true, sessionsValidFrom: true } },
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
      sessionsValidFrom: membership.user.sessionsValidFrom,
    };
    return row && tenant ? { row, tenant } : null;
  });

  if (!loaded || loaded.row.status !== "active" || loaded.row.userId !== session.uid || !sessionStillValid(issuedAt, loaded.row.sessionsValidFrom) || loaded.tenant.status !== "active") return null;
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
      plan: loaded.tenant.plan,
      billingStatus: loaded.tenant.billingStatus as BillingStatus,
      stripeAccountId: loaded.tenant.stripeAccountId,
      workspaceKind: loaded.tenant.workspaceKind === "freight" ? "freight" : "ferry",
    },
    billing: billingAccess({
      status: loaded.tenant.billingStatus as BillingStatus,
      trialEndsAt: loaded.tenant.trialEndsAt,
      currentPeriodEnd: loaded.tenant.currentPeriodEnd,
      pastDueSince: loaded.tenant.pastDueSince,
    }),
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

/**
 * For anything that changes data. Same as requirePermission, plus: when the operator's trial or subscription has
 * lapsed they can still look around and export, but not sell, so this sends them to the billing page instead.
 */
export async function requireWrite(permission: Permission): Promise<AuthContext> {
  const auth = await requirePermission(permission);
  if (auth.billing.level !== "full") redirect("/app/billing?locked=1");
  return auth;
}
