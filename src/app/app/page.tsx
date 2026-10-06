import { ClipboardCheck, Plus, Receipt, Ticket } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { VoyageCard } from "@/components/app/voyage-card";
import { withTenant } from "@/db";
import { formatMoney } from "@/lib/money";
import { can, requireAuth } from "@/server/auth";
import { dashboardStats, listUpcomingVoyages } from "@/server/queries";
import { Ship } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const auth = await requireAuth();
  const { stats, voyages } = await withTenant(auth.tenantId, async (tx) => ({
    stats: await dashboardStats(tx),
    voyages: await listUpcomingVoyages(tx, { limit: 6 }),
  }));
  const firstName = auth.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        description="Here is what's happening across your sailings."
        actions={can(auth, "booking.create") && <ButtonLink href="/app/bookings/new"><Plus className="size-4" aria-hidden />New booking</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Ticket} label="Bookings today" value={stats.todayBookings} />
        <StatCard icon={Receipt} tone="ok" label="Sales today" value={formatMoney(stats.todayRevenue, auth.tenant.baseCurrency, auth.tenant.locale)} />
        <StatCard icon={ClipboardCheck} tone="warn" label="Need review" value={stats.needsReview} hint={stats.needsReview ? <a className="font-medium text-brand-700 hover:underline" href="/app/review">Review now</a> : "All clear"} />
        <StatCard icon={Receipt} tone="warn" label="Unpaid invoices" value={stats.unpaidCount} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Upcoming voyages</h2>
      {voyages.length === 0 ? (
        <Card><EmptyState icon={Ship} title="No upcoming voyages" description="Schedule a voyage to start taking bookings." action={can(auth, "voyage.manage") && <ButtonLink href="/app/voyages/new">Schedule a voyage</ButtonLink>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{voyages.map((v) => <VoyageCard key={v.id} v={v} />)}</div>
      )}
    </>
  );
}
