"use server";

import { redirect } from "next/navigation";
import { adminDb } from "@/db";
import { PLANS, planById } from "@/lib/plans";
import { requirePermission } from "./auth";
import { appBaseUrl } from "./base-url";
import { createPortalSession, createSubscriptionCheckout, priceIdFor, stripeConfigured, StripeError } from "./stripe";

export type BillingActionState = { error?: string };

// These deliberately use requirePermission, not requireWrite: a locked account must still be able to pay.

export async function subscribeAction(_prev: BillingActionState, f: FormData): Promise<BillingActionState> {
  const auth = await requirePermission("settings.manage");
  if (!stripeConfigured()) return { error: "Online billing isn't switched on yet. Contact support to subscribe." };
  const plan = planById(String(f.get("plan") ?? ""));
  if (!plan || !PLANS.some((p) => p.id === plan.id)) return { error: "Choose a plan." };
  if (!priceIdFor(plan.id)) return { error: "That plan isn't available yet. Contact support." };
  const tenant = await adminDb().tenant.findUnique({ where: { id: auth.tenantId }, select: { stripeCustomerId: true } });
  let url: string;
  try {
    url = await createSubscriptionCheckout({ tenantId: auth.tenantId, plan: plan.id, email: auth.email, customerId: tenant?.stripeCustomerId, baseUrl: await appBaseUrl() });
  } catch (e) {
    if (e instanceof StripeError) return { error: e.message };
    throw e;
  }
  redirect(url);
}

export async function manageBillingAction(): Promise<void> {
  const auth = await requirePermission("settings.manage");
  const tenant = await adminDb().tenant.findUnique({ where: { id: auth.tenantId }, select: { stripeCustomerId: true } });
  if (!stripeConfigured() || !tenant?.stripeCustomerId) redirect("/app/billing");
  redirect(await createPortalSession(tenant.stripeCustomerId, await appBaseUrl()));
}
