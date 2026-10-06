import { Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { withTenant } from "@/db";
import { formatDeparture } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { can, requirePermission } from "@/server/auth";
import { formatBookingNo, getTenantConfig } from "@/server/shared";
import { listBookings } from "@/server/queries";

export const metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const auth = await requirePermission("booking.view");
  const { rows, config } = await withTenant(auth.tenantId, async (tx) => ({ rows: await listBookings(tx), config: await getTenantConfig(tx) }));
  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every booking, newest first."
        actions={can(auth, "booking.create") && <ButtonLink href="/app/bookings/new"><Plus className="size-4" aria-hidden />New booking</ButtonLink>}
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Ticket} title="No bookings yet" description="Bookings you create or sync from the ticket desk appear here." />
        ) : (
          <Table>
            <thead><tr><Th>Booking</Th><Th>Customer</Th><Th>Voyage</Th><Th>Status</Th><Th>Payment</Th><Th className="text-right">Total</Th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <Tr key={b.id}>
                  <Td><Link className="font-medium text-brand-700 hover:underline" href={`/app/bookings/${b.id}`}>{formatBookingNo(config, b.bookingNo)}</Link></Td>
                  <Td>{b.contactName}</Td>
                  <Td><span className="block">{b.originName} → {b.destinationName}</span><span className="text-xs text-muted">{formatDeparture(b.departureAt)}</span></Td>
                  <Td><StatusBadge status={b.status} /></Td>
                  <Td>{b.invoiceStatus ? <StatusBadge status={b.invoiceStatus} /> : <span className="text-subtle">—</span>}</Td>
                  <Td className="tabular text-right font-medium">{formatMoney(b.total, b.currency, auth.tenant.locale)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
