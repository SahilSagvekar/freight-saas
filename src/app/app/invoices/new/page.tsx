import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BillingFormView } from "@/components/app/billing-form";
import { PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { billFormFrom, emptyBillForm, type BillForm } from "@/lib/billing-form";
import { addDays } from "@/lib/freight-billing";
import { localDateString } from "@/lib/tz";
import { requirePermission } from "@/server/auth";
import { formatQuoteNo, formatShipmentNo, getTenantConfig } from "@/server/shared";
import { partyOf } from "@/server/shipments";

export const metadata = { title: "New invoice" };
const UUID = /^[0-9a-f-]{36}$/i;

/** Starts blank, or from a quote (copies customer and charges) or a shipment (bills the shipper). */
export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ quote?: string; shipment?: string }> }) {
  const sp = await searchParams;
  const auth = await requirePermission("payment.record");
  const today = localDateString(new Date(), auth.tenant.timeZone);
  const { config, quote, shipment } = await withTenant(auth.tenantId, async (tx) => ({
    config: await getTenantConfig(tx),
    quote: sp.quote && UUID.test(sp.quote) ? await tx.quote.findUnique({ where: { id: sp.quote } }) : null,
    shipment: sp.shipment && UUID.test(sp.shipment) ? await tx.shipment.findUnique({ where: { id: sp.shipment }, select: { id: true, shipmentNo: true, shipper: true, customerRef: true } }) : null,
  }));
  const dates: Partial<BillForm> = { issuedOn: today, dueOn: addDays(today, config.invoiceDueDays), notes: config.invoiceNote, taxPercent: String(config.freightTaxBp / 100) };
  let initial: BillForm = emptyBillForm(dates);
  let shipmentId: string | null = null;
  if (quote) {
    initial = billFormFrom(quote, { ...dates, taxPercent: String(quote.taxBp / 100), reference: formatQuoteNo(quote.quoteNo) });
    shipmentId = quote.shipmentId;
  } else if (shipment) {
    const p = partyOf(shipment.shipper);
    initial = emptyBillForm({ ...dates, customerName: p.name, customerEmail: p.email ?? "", customerAddress: p.address, reference: shipment.customerRef || formatShipmentNo(shipment.shipmentNo) });
    shipmentId = shipment.id;
  }
  return (
    <>
      <PageHeader back={<Link href="/app/invoices" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />All invoices</Link>} title="New invoice" />
      <BillingFormView kind="invoice" initial={initial} docId={null} currency={quote?.currency ?? auth.tenant.baseCurrency} links={{ shipmentId, quoteId: quote?.id ?? null }} />
    </>
  );
}
