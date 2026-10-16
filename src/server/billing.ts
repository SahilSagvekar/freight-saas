import { adminDb, withTenant } from "@/db";
import { mapStripeStatus, planLimitProblem } from "@/lib/billing";
import { paymentFailedEmail } from "@/lib/email-templates";
import { recordPayment, BookingError } from "./bookings";
import { appBaseUrl } from "./base-url";
import { sendMail } from "./mail";
import { audit } from "./shared";
import { planForPriceId } from "./stripe";
import { emailTicket } from "./public-booking";
import type { Tx } from "@/db";

/** The part of a Stripe event we read. Everything else is ignored. */
export type StripeEvent = {
  id: string;
  type: string;
  account?: string;
  data: { object: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const secs = (n: unknown): Date | null => (typeof n === "number" && n > 0 ? new Date(n * 1000) : null);

async function tenantFor(sub: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const byMeta = typeof sub.metadata?.tenantId === "string" ? sub.metadata.tenantId : undefined;
  const byCustomer = typeof sub.customer === "string" ? sub.customer : undefined;
  if (byCustomer) {
    const t = await adminDb().tenant.findUnique({ where: { stripeCustomerId: byCustomer } });
    if (t) return t;
  }
  return byMeta ? adminDb().tenant.findUnique({ where: { id: byMeta } }) : null;
}

/** Applies a Stripe subscription object to the matching operator. The subscription is the source of truth, so replays are harmless. */
async function applySubscription(sub: Record<string, any>, deleted = false) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const tenant = await tenantFor(sub);
  if (!tenant) return;
  const status = deleted ? "canceled" : mapStripeStatus(String(sub.status));
  if (!status) return;
  const item = sub.items?.data?.[0];
  const periodEnd = secs(sub.current_period_end) ?? secs(item?.current_period_end);
  const plan = planForPriceId(item?.price?.id) ?? (typeof sub.metadata?.plan === "string" ? sub.metadata.plan : null);
  await adminDb().tenant.update({
    where: { id: tenant.id },
    data: {
      billingStatus: status,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : tenant.stripeCustomerId,
      stripeSubscriptionId: typeof sub.id === "string" ? sub.id : tenant.stripeSubscriptionId,
      currentPeriodEnd: periodEnd ?? tenant.currentPeriodEnd,
      pastDueSince: status === "past_due" ? (tenant.pastDueSince ?? new Date()) : null,
      ...(plan === "starter" || plan === "operator" ? { plan } : {}),
    },
  });
}

async function ownerEmails(tenantId: string) {
  return adminDb().$queryRaw<{ email: string; name: string }[]>`
    select distinct u.email, u.name from memberships m join users u on u.id = m.user_id join roles r on r.id = m.role_id
    where m.tenant_id = ${tenantId}::uuid and m.status = 'active' and 'settings.manage' = any(r.permissions)`;
}

/** Records the card payment for a public booking, once, onto the operator whose Stripe account took it. */
async function applyTicketPayment(event: StripeEvent) {
  const session = event.data.object;
  const bookingId = session.metadata?.bookingId;
  if (typeof bookingId !== "string" || session.payment_status !== "paid") return;
  const owner = await adminDb().booking.findUnique({ where: { id: bookingId }, select: { tenantId: true, tenant: { select: { stripeAccountId: true } } } });
  // The event must come from the account that belongs to the booking's operator.
  if (!owner || !event.account || owner.tenant.stripeAccountId !== event.account) return;

  const reference = `stripe:${session.id}`;
  let recorded = false;
  await withTenant(owner.tenantId, async (tx: Tx) => {
    const invoice = await tx.invoice.findUnique({ where: { bookingId } });
    if (!invoice) return;
    if (await tx.payment.findFirst({ where: { invoiceId: invoice.id, reference } })) return; // already recorded
    try {
      await recordPayment(tx, { tenantId: owner.tenantId, actorId: null }, invoice.id, { method: "CARD", amount: Number(session.amount_total), reference });
      recorded = true;
    } catch (e) {
      if (!(e instanceof BookingError)) throw e;
      // Paid after the booking was cancelled or expired: leave a trail so the operator can refund in Stripe.
      await audit(tx, { tenantId: owner.tenantId, actorId: null, action: "payment.orphaned", entity: "invoice", entityId: invoice.id, after: { stripeSession: session.id, amount: session.amount_total, reason: e.message } });
    }
  });
  // Only the first delivery sends the ticket; a repeat of the same event does nothing.
  if (recorded) await emailTicket(owner.tenantId, bookingId, true).catch((e) => console.error("ticket email failed", e));
}

export async function handleStripeEvent(event: StripeEvent): Promise<void> {
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      if (obj.mode === "subscription") {
        const tenantId = obj.client_reference_id;
        if (typeof tenantId !== "string") return;
        await adminDb().tenant.updateMany({
          where: { id: tenantId },
          data: { billingStatus: "active", stripeCustomerId: typeof obj.customer === "string" ? obj.customer : undefined, stripeSubscriptionId: typeof obj.subscription === "string" ? obj.subscription : undefined, pastDueSince: null, ...(obj.metadata?.plan === "starter" || obj.metadata?.plan === "operator" ? { plan: obj.metadata.plan } : {}) },
        });
      } else if (obj.mode === "payment") {
        await applyTicketPayment(event);
      }
      return;
    }
    case "checkout.session.async_payment_succeeded":
      await applyTicketPayment(event);
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await applySubscription(obj);
      return;
    case "customer.subscription.deleted":
      await applySubscription(obj, true);
      return;
    case "invoice.payment_failed": {
      const tenant = typeof obj.customer === "string" ? await adminDb().tenant.findUnique({ where: { stripeCustomerId: obj.customer } }) : null;
      if (!tenant) return;
      const base = await appBaseUrl().catch(() => process.env.APP_URL ?? "");
      for (const o of await ownerEmails(tenant.id)) await sendMail(o.email, paymentFailedEmail({ name: o.name, operator: tenant.name, url: `${base}/app/billing` }));
      return;
    }
    default:
      return;
  }
}

/** Throws a plain-language error when adding one more `kind` would go past the operator's plan. */
export async function assertWithinPlan(tx: Tx, tenantId: string, kind: "vessel" | "user"): Promise<void> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, billingStatus: true } });
  if (!tenant) return;
  const plan = tenant.billingStatus === "comped" ? null : tenant.plan;
  const current = kind === "vessel" ? await tx.vessel.count({ where: { tenantId, active: true } }) : await tx.membership.count({ where: { tenantId, status: "active" } });
  const problem = planLimitProblem(plan, kind, current);
  if (problem) throw new BookingError("INVALID", problem);
}
