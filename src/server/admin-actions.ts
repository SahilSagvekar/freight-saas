"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminDb } from "@/db";
import { SETUP_LINK_TTL_HOURS } from "@/lib/tokens";
import type { ActionResult } from "./booking-actions";
import { logAdminAction, requirePlatformAdmin } from "./admin";
import { appBaseUrl } from "./base-url";
import { issueSetupLink } from "./setup-links";

const id = z.string().uuid();

async function guarded<T>(tenantId: string, fn: (actorId: string) => Promise<T>): Promise<ActionResult<T>> {
  const auth = await requirePlatformAdmin();
  if (!id.safeParse(tenantId).success) return { ok: false, error: "Unknown operator." };
  try {
    const data = await fn(auth.userId);
    revalidatePath("/admin");
    return { ok: true, data };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Something went wrong." };
  }
}

export async function setTenantStatusAction(tenantId: string, status: "active" | "suspended"): Promise<ActionResult> {
  if (status !== "active" && status !== "suspended") return { ok: false, error: "Unknown status." };
  return guarded(tenantId, async (actor) => {
    await adminDb().tenant.update({ where: { id: tenantId }, data: { status } });
    await logAdminAction(actor, tenantId, status === "suspended" ? "suspend" : "reactivate");
  });
}

export async function extendTrialAction(tenantId: string, days: number): Promise<ActionResult> {
  if (!Number.isInteger(days) || days < 1 || days > 90) return { ok: false, error: "Choose 1 to 90 days." };
  return guarded(tenantId, async (actor) => {
    const t = await adminDb().tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { trialEndsAt: true } });
    const from = t.trialEndsAt && t.trialEndsAt > new Date() ? t.trialEndsAt : new Date();
    await adminDb().tenant.update({ where: { id: tenantId }, data: { billingStatus: "trialing", trialEndsAt: new Date(from.getTime() + days * 86_400_000) } });
    await logAdminAction(actor, tenantId, "extend-trial", { days });
  });
}

export async function setCompedAction(tenantId: string, comped: boolean): Promise<ActionResult> {
  return guarded(tenantId, async (actor) => {
    await adminDb().tenant.update({ where: { id: tenantId }, data: comped ? { billingStatus: "comped" } : { billingStatus: "trialing", trialEndsAt: new Date(Date.now() + 14 * 86_400_000) } });
    await logAdminAction(actor, tenantId, comped ? "comp" : "uncomp");
  });
}

/** A fresh one-time sign-in link for an operator's oldest active owner, for support. It does not reveal or change anything else. */
export async function ownerLinkAction(tenantId: string): Promise<ActionResult<{ link: string; email: string }>> {
  return guarded(tenantId, async (actor) => {
    const owners = await adminDb().$queryRaw<{ id: string; email: string }[]>`
      select u.id, u.email from memberships m join users u on u.id = m.user_id join roles r on r.id = m.role_id
      where m.tenant_id = ${tenantId}::uuid and m.status = 'active' and r.is_system order by m.created_at asc limit 1`;
    const owner = owners[0];
    if (!owner) throw new Error("No active owner");
    await logAdminAction(actor, tenantId, "owner-link", { email: owner.email });
    return { link: await issueSetupLink(owner.id, await appBaseUrl(), SETUP_LINK_TTL_HOURS), email: owner.email };
  });
}
