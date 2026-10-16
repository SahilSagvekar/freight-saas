import { Download } from "lucide-react";
import { ButtonLink, Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { withTenant } from "@/db";
import { formatDeparture } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { localDateString } from "@/lib/tz";
import { requirePermission } from "@/server/auth";
import { dailyReport } from "@/server/reports";
import { Receipt, Ticket, Undo2, Wallet } from "lucide-react";

export const metadata = { title: "Daily report" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const auth = await requirePermission("invoice.view");
  const { date: raw } = await searchParams;
  const today = localDateString(new Date(), auth.tenant.timeZone);
  const date = typeof raw === "string" && raw ? raw : today;
  const report = await withTenant(auth.tenantId, (tx) => dailyReport(tx, date, auth.tenant.timeZone));
  const money = (n: number) => formatMoney(n, auth.tenant.baseCurrency, auth.tenant.locale);

  return (
    <>
      <PageHeader
        title="Daily report"
        description={`Sales, cash and sailings for one day, in ${auth.tenant.timeZone} time.`}
        actions={
          <>
            <form className="flex items-center gap-2" action="/app/reports">
              <Input type="date" name="date" defaultValue={date} max={today} className="h-10 w-44" aria-label="Report date" />
              <Button type="submit" variant="secondary">Show</Button>
            </form>
            {report && <ButtonLink href={`/api/reports/daily?date=${report.date}`} variant="secondary"><Download className="size-4" aria-hidden />CSV</ButtonLink>}
          </>
        }
      />
      {!report ? (
        <Card><EmptyState icon={Receipt} title="That date isn't valid" description="Pick a date from the calendar." /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Ticket} label="Bookings" value={report.bookings.confirmed} hint={`${report.bookings.cancelled} cancelled · ${report.bookings.needsReview} to review`} />
            <StatCard icon={Receipt} tone="ok" label="Sales" value={money(report.sales.total)} hint={`${money(report.sales.tax)} tax`} />
            <StatCard icon={Wallet} tone="ok" label="Net takings" value={money(report.netCash)} hint="Collected minus refunds" />
            <StatCard icon={Undo2} tone="warn" label="Refunded" value={money(report.refunded)} hint={`${report.outstanding.count} unpaid · ${money(report.outstanding.amount)} owed`} />
          </div>

          <Card>
            <CardHeader title="Sailings" description="Departures on this day." />
            {report.byVoyage.length === 0 ? (
              <CardBody className="text-sm text-muted">No sailings.</CardBody>
            ) : (
              <Table>
                <thead><tr><Th>Voyage</Th><Th className="text-right">Bookings</Th><Th className="text-right">Passengers</Th><Th className="text-right">Vehicles</Th><Th className="text-right">Cargo</Th><Th className="text-right">Revenue</Th></tr></thead>
                <tbody>
                  {report.byVoyage.map((v) => (
                    <Tr key={v.id}>
                      <Td><span className="font-medium">{v.label}</span><span className="block text-xs text-muted">{formatDeparture(v.departureAt)} · {v.status.toLowerCase()}</span></Td>
                      <Td className="tabular text-right">{v.bookings}</Td>
                      <Td className="tabular text-right">{v.passengers}</Td>
                      <Td className="tabular text-right">{v.vehicles}</Td>
                      <Td className="tabular text-right">{v.cargo}{v.cargoWeightKg ? <span className="block text-xs text-muted">{v.cargoWeightKg} kg</span> : null}</Td>
                      <Td className="tabular text-right font-medium">{money(v.revenue)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="By payment method" />
              <Table>
                <tbody>
                  {Object.entries(report.collected).map(([m, amount]) => (
                    <Tr key={m}><Td className="capitalize">{m.replace("_", " ").toLowerCase()}</Td><Td className="tabular text-right">{money(amount)}</Td></Tr>
                  ))}
                  <Tr><Td className="font-medium">Refunded</Td><Td className="tabular text-right text-danger-700">−{money(report.refunded)}</Td></Tr>
                </tbody>
              </Table>
            </Card>
            <Card>
              <CardHeader title="By cashier" />
              {report.byCashier.length === 0 ? (
                <CardBody className="text-sm text-muted">No payments taken.</CardBody>
              ) : (
                <Table>
                  <thead><tr><Th>Person</Th><Th className="text-right">Collected</Th><Th className="text-right">Refunded</Th><Th className="text-right">Net</Th></tr></thead>
                  <tbody>
                    {report.byCashier.map((c) => (
                      <Tr key={c.name}><Td>{c.name}</Td><Td className="tabular text-right">{money(c.collected)}</Td><Td className="tabular text-right">{money(c.refunded)}</Td><Td className="tabular text-right font-medium">{money(c.net)}</Td></Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
