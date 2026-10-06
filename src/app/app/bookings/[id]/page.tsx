import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelBookingButton, PaymentForm, ReviewButtons } from "@/components/app/booking-actions";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { withTenant } from "@/db";
import { describeAttributes } from "@/lib/attributes";
import type { FieldDef } from "@/lib/domain";
import { formatDateTime, formatDeparture } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { can, requirePermission } from "@/server/auth";
import { getBookingDetail } from "@/server/queries";
import { formatBookingNo, formatInvoiceNo, getTenantConfig } from "@/server/shared";

export default async function BookingPage({ params }: PageProps<"/app/bookings/[id]">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const loaded = await withTenant(auth.tenantId, async (tx) => ({ d: await getBookingDetail(tx, id), config: await getTenantConfig(tx) }));
  if (!loaded.d) notFound();
  const { booking, voyage, lines, invoice, payments, types } = loaded.d;
  const { config } = loaded;
  const money = (n: number) => formatMoney(n, booking.currency, auth.tenant.locale);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = invoice ? invoice.total - paid : 0;
  const typeById = new Map(types.map((t) => [t.id, t]));

  return (
    <>
      <PageHeader
        back={<Link href="/app/bookings" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Bookings</Link>}
        title={formatBookingNo(config, booking.bookingNo)}
        description={<>{booking.contactName}{booking.contactPhone ? ` · ${booking.contactPhone}` : ""} · created {formatDateTime(booking.createdAt)}</>}
        actions={<StatusBadge status={booking.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {booking.status === "NEEDS_REVIEW" && (
            <Alert tone="warning" title="This booking needs a decision">
              <p>{booking.reviewReason}</p>
              {can(auth, "booking.review") && <div className="mt-3"><ReviewButtons bookingId={booking.id} /></div>}
            </Alert>
          )}
          <Card>
            <CardHeader title="Items" />
            <Table>
              <thead><tr><Th>Item</Th><Th className="text-right">Qty</Th><Th className="text-right">Unit</Th><Th className="text-right">Total</Th></tr></thead>
              <tbody>
                {lines.map((l) => {
                  const detail = describeAttributes((typeById.get(l.itemTypeId)?.fieldSchema as FieldDef[] | undefined) ?? [], l.attributes as Record<string, string | number | boolean>);
                  return (
                    <Tr key={l.id}>
                      <Td><span className="font-medium">{l.description}</span>{detail && <span className="block text-xs text-muted">{detail}</span>}</Td>
                      <Td className="tabular text-right">{l.quantity}</Td>
                      <Td className="tabular text-right">{money(l.unitPrice)}</Td>
                      <Td className="tabular text-right font-medium">{money(l.total)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <dl className="ml-auto max-w-xs space-y-1 border-t border-line p-5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular">{money(booking.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd className="tabular">{money(booking.taxTotal)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular">{money(booking.total)}</dd></div>
            </dl>
          </Card>
          {booking.notes && <Card><CardBody><p className="text-sm font-medium">Notes</p><p className="mt-1 text-sm text-muted">{booking.notes}</p></CardBody></Card>}
        </div>

        <div className="space-y-6">
          {voyage && (
            <Card>
              <CardHeader title="Voyage" />
              <CardBody className="space-y-1 text-sm">
                <Link href={`/app/voyages/${voyage.id}`} className="font-medium text-brand-700 hover:underline">{voyage.originName} → {voyage.destinationName}</Link>
                <p className="text-muted">{formatDeparture(voyage.departureAt)}</p>
                <p className="text-muted">{voyage.vesselName}</p>
              </CardBody>
            </Card>
          )}
          {invoice && (
            <Card>
              <CardHeader title={formatInvoiceNo(config, invoice.invoiceNo)} action={<StatusBadge status={invoice.status} />} />
              <CardBody className="space-y-4">
                {payments.length > 0 && (
                  <ul className="space-y-1.5 text-sm">
                    {payments.map((p) => <li key={p.id} className="flex justify-between"><span className="text-muted">{formatDateTime(p.receivedAt)} · {p.method.replace("_", " ").toLowerCase()}</span><span className="tabular font-medium">{money(p.amount)}</span></li>)}
                  </ul>
                )}
                {outstanding > 0 && invoice.status !== "VOID" && can(auth, "payment.record") && <PaymentForm invoiceId={invoice.id} currency={booking.currency} locale={auth.tenant.locale} outstanding={outstanding} />}
                {invoice.status === "PAID" && <p className="text-sm text-ok-700">Paid in full.</p>}
              </CardBody>
            </Card>
          )}
          {booking.status === "CONFIRMED" && can(auth, "booking.cancel") && <CancelBookingButton bookingId={booking.id} />}
        </div>
      </div>
    </>
  );
}
