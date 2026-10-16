import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { formatDate } from "@/lib/format";
import { listTenants, requirePlatformAdmin } from "@/server/admin";
import { AdminRowActions } from "./row-actions";

export const metadata = { title: "Platform admin" };
export const dynamic = "force-dynamic";

const TONE = { active: "ok", trialing: "brand", comped: "neutral", past_due: "warn", canceled: "danger" } as const;

export default async function AdminPage() {
  await requirePlatformAdmin();
  const tenants = await listTenants();
  const count = (s: string) => tenants.filter((t) => t.billingStatus === s).length;
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="Platform admin" description={`${tenants.length} operators · ${count("active")} paying · ${count("trialing")} on trial · ${count("past_due")} past due · ${count("comped")} complimentary`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Operator</th><th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">Billing</th>
                <th className="px-4 py-2.5 text-right">People</th><th className="px-4 py-2.5 text-right">Vessels</th><th className="px-4 py-2.5 text-right">Bookings</th>
                <th className="px-4 py-2.5">Last booking</th><th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3"><span className="font-medium">{t.name}</span>{t.status !== "active" && <Badge tone="danger" className="ml-2">{t.status}</Badge>}<span className="block text-xs text-muted">{t.slug} · since {formatDate(t.createdAt)}</span></td>
                  <td className="px-4 py-3 capitalize">{t.plan}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[t.billingStatus as keyof typeof TONE] ?? "neutral"}>{t.billingStatus.replace("_", " ")}</Badge>{t.billingStatus === "trialing" && t.trialEndsAt && <span className="block text-xs text-muted">ends {formatDate(t.trialEndsAt)}</span>}</td>
                  <td className="tabular px-4 py-3 text-right">{t.people}</td>
                  <td className="tabular px-4 py-3 text-right">{t.vessels}</td>
                  <td className="tabular px-4 py-3 text-right">{t.bookings}</td>
                  <td className="px-4 py-3 text-muted">{t.lastBookingAt ? formatDate(t.lastBookingAt) : "never"}</td>
                  <td className="px-4 py-3"><AdminRowActions tenantId={t.id} suspended={t.status !== "active"} comped={t.billingStatus === "comped"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-4 text-xs text-muted">This console shows counts and billing only. It cannot read bookings or passenger details, and there is no impersonation: use a one-time owner link when you need to help someone sign in.</p>
    </main>
  );
}
