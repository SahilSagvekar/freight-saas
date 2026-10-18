import { FileText, Inbox, Package, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { InquiryStatusBadge } from "@/components/app/inquiry-status";
import { ShipmentStatusBadge } from "@/components/app/shipment-status";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/page";
import { withTenant } from "@/db";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { localDateString } from "@/lib/tz";
import { can, type AuthContext } from "@/server/auth";
import { receivables } from "@/server/freight-invoices";
import { inquiryCounts, listInquiries } from "@/server/inquiries";
import { quoteCounts } from "@/server/quotes";
import { formatInquiryNo, formatShipmentNo } from "@/server/shared";
import { listShipments, shipmentCounts } from "@/server/shipments";

/** The home screen of a freight workspace. Each block appears only if the signed-in role can open what it links to. */
export async function FreightDashboard({ auth }: { auth: AuthContext }) {
  const canQuote = can(auth, "booking.create");
  const canShip = can(auth, "booking.view");
  const canInvoice = can(auth, "invoice.view");
  const today = localDateString(new Date(), auth.tenant.timeZone);
  const currency = auth.tenant.baseCurrency;

  const d = await withTenant(auth.tenantId, async (tx) => ({
    inquiries: canQuote ? await inquiryCounts(tx) : null,
    newInquiries: canQuote ? (await listInquiries(tx, { status: "NEW", limit: 5 })) : [],
    quotes: canQuote ? await quoteCounts(tx) : null,
    shipments: canShip ? await shipmentCounts(tx) : null,
    active: canShip ? await listShipments(tx, { status: "active", limit: 5 }) : [],
    owed: canInvoice ? await receivables(tx, currency, today) : null,
  }));
  const firstName = auth.name.split(" ")[0];

  return (
    <>
      <DashboardHeader name={firstName} canCreate={canShip && can(auth, "booking.create")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {d.inquiries && <StatCard icon={Inbox} tone="warn" label="New inquiries" value={d.inquiries.NEW} hint={d.inquiries.NEW ? <Link className="font-medium text-brand-700 hover:underline" href="/app/inquiries?status=NEW">Reply now</Link> : "All answered"} />}
        {d.quotes && <StatCard icon={FileText} label="Quotes waiting" value={d.quotes.DRAFT + d.quotes.SENT} hint={`${d.quotes.SENT} sent, ${d.quotes.DRAFT} draft`} />}
        {d.shipments && <StatCard icon={Package} tone="ok" label="Active shipments" value={d.shipments.active} hint={`${d.shipments.by.DELIVERED ?? 0} delivered`} />}
        {d.owed && <StatCard icon={Receipt} tone="warn" label="Owed to you" value={formatMoney(d.owed.amount, currency, auth.tenant.locale)} hint={d.owed.overdueCount ? <span className="font-medium text-danger-600">{d.owed.overdueCount} overdue ({formatMoney(d.owed.overdueAmount, currency, auth.tenant.locale)})</span> : `${d.owed.count} unpaid`} />}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {canQuote && (
          <Card>
            <CardHeader title="New inquiries" action={<Link className="text-sm text-brand-700 hover:underline" href="/app/inquiries">See all</Link>} />
            {d.newInquiries.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Nothing waiting. New requests from your website form land here.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {d.newInquiries.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0"><Link className="font-medium text-brand-700 hover:underline" href={`/app/inquiries/${r.id}`}>{formatInquiryNo(r.inquiryNo)} · {r.name}</Link><p className="truncate text-muted">{r.origin} → {r.destination}</p></div>
                    <div className="shrink-0 text-right"><InquiryStatusBadge status={r.status} /><p className="mt-1 text-xs text-muted">{formatDateTime(r.createdAt)}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {canShip && (
          <Card>
            <CardHeader title="Shipments in progress" action={<Link className="text-sm text-brand-700 hover:underline" href="/app/shipments">See all</Link>} />
            {d.active.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No active shipments. Convert an inquiry or create one.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {d.active.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0"><Link className="font-medium text-brand-700 hover:underline" href={`/app/shipments/${s.id}`}>{formatShipmentNo(s.shipmentNo)}</Link><p className="truncate text-muted">{s.origin} → {s.destination}</p></div>
                    <ShipmentStatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function DashboardHeader({ name, canCreate }: { name?: string; canCreate: boolean }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Hello, {name}</h1>
        <p className="mt-1 text-sm text-muted">Here is what needs you today.</p>
      </div>
      {canCreate && <ButtonLink href="/app/shipments/new"><Plus className="size-4" aria-hidden />New shipment</ButtonLink>}
    </header>
  );
}
