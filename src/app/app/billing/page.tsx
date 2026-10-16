import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { adminDb } from "@/db";
import { formatDate } from "@/lib/format";
import { planById } from "@/lib/plans";
import { requirePermission } from "@/server/auth";
import { stripeConfigured } from "@/server/stripe";
import { BillingActions } from "./billing-actions";

export const metadata = { title: "Billing" };

const STATUS_LABEL = { comped: "Complimentary", trialing: "Free trial", active: "Active", past_due: "Payment failed", canceled: "Cancelled" } as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ locked?: string; done?: string }> }) {
  const auth = await requirePermission("settings.manage");
  const sp = await searchParams;
  const [tenant, vessels, people] = await Promise.all([
    adminDb().tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { plan: true, billingStatus: true, trialEndsAt: true, currentPeriodEnd: true, stripeCustomerId: true } }),
    adminDb().vessel.count({ where: { tenantId: auth.tenantId, active: true } }),
    adminDb().membership.count({ where: { tenantId: auth.tenantId, status: "active" } }),
  ]);
  const plan = planById(tenant.plan);
  const comped = tenant.billingStatus === "comped";

  return (
    <>
      <PageHeader title="Billing" description="Your plan, usage and payment details." />
      <div className="max-w-2xl space-y-6">
        {sp.locked && <Alert tone="error" title="Selling is paused">Your trial or subscription has ended, so changes are switched off. You can still view and export everything.</Alert>}
        {sp.done && <Alert tone="success">Thanks! Your subscription is being set up. This page updates in a moment.</Alert>}
        <Card>
          <CardHeader title={comped ? "Complimentary account" : `${plan?.name ?? tenant.plan} plan`} action={<Badge tone={tenant.billingStatus === "active" || comped ? "ok" : tenant.billingStatus === "trialing" ? "brand" : "warn"}>{STATUS_LABEL[tenant.billingStatus as keyof typeof STATUS_LABEL] ?? tenant.billingStatus}</Badge>} />
          <CardBody className="space-y-2 text-sm">
            {tenant.billingStatus === "trialing" && tenant.trialEndsAt && <p>Trial ends <strong>{formatDate(tenant.trialEndsAt)}</strong>.</p>}
            {tenant.billingStatus === "active" && tenant.currentPeriodEnd && <p>Renews on <strong>{formatDate(tenant.currentPeriodEnd)}</strong>.</p>}
            {tenant.billingStatus === "canceled" && tenant.currentPeriodEnd && <p>Access ends <strong>{formatDate(tenant.currentPeriodEnd)}</strong>.</p>}
            <p className="text-muted">
              Vessels: {vessels}{plan && !comped ? ` of ${plan.maxVessels}` : ""} · People: {people}{plan && !comped ? ` of ${plan.maxUsers}` : ""}
            </p>
          </CardBody>
        </Card>
        {!comped && <BillingActions hasCustomer={Boolean(tenant.stripeCustomerId)} active={tenant.billingStatus === "active" || tenant.billingStatus === "past_due"} currentPlan={tenant.plan} configured={stripeConfigured()} />}
      </div>
    </>
  );
}
