import { notFound } from "next/navigation";
import { Box, DocToolbar, DOC_SHEET, Letterhead, PartyBlock } from "@/components/app/doc-parts";
import { withTenant } from "@/db";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { requirePermission } from "@/server/auth";
import { loadShipmentDoc } from "@/server/shipment-docs";
import { formatShipmentNo } from "@/server/shared";

export const metadata = { title: "Commercial invoice" };

/** A commercial invoice for customs, built from the goods values on the shipment. The values are the shipper's declaration. */
export default async function CommercialInvoicePage({ params }: PageProps<"/app/shipments/[id]/invoice">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await withTenant(auth.tenantId, (tx) => loadShipmentDoc(tx, auth.tenant.name, id));
  if (!d) notFound();
  const { s, lines, totals } = d;
  const missing = lines.filter((l) => !l.declaredValue).length;

  return (
    <>
      <DocToolbar backHref={`/app/shipments/${s.id}`} backLabel={formatShipmentNo(s.shipmentNo)} printLabel="Print commercial invoice" />
      <article className={DOC_SHEET}>
        <Letterhead company={d.company} title="Commercial invoice" number={formatShipmentNo(s.shipmentNo)} sub={s.customerRef ? `Ref. ${s.customerRef}` : undefined} />
        <div className="mt-4 grid grid-cols-2 [&>*]:-mt-px [&>*]:-ml-px">
          <Box label="Exporter (shipper)"><PartyBlock party={d.shipper} /></Box>
          <Box label="Consignee (buyer)"><PartyBlock party={d.consignee} /></Box>
          <Box label="Country or port of origin">{s.origin}</Box>
          <Box label="Destination">{s.destination}</Box>
          <Box label="Incoterm">{s.incoterm || "—"}</Box>
          <Box label="Currency">{s.currency}</Box>
        </div>
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-ink text-left text-xs uppercase tracking-wide">
              <th className="py-2 pr-2">HS code</th><th className="py-2 pr-2">Description</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 pr-2 text-right">Unit value</th><th className="py-2 text-right">Total value</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-1.5 pr-2 font-mono text-xs">{l.hsCode ?? ""}</td>
                <td className="py-1.5 pr-2">{l.description}</td>
                <td className="py-1.5 pr-2 text-right">{l.quantity}</td>
                <td className="py-1.5 pr-2 text-right">{l.declaredValue ? formatMoney(Math.round(l.declaredValue / l.quantity), s.currency) : ""}</td>
                <td className="py-1.5 text-right">{l.declaredValue ? formatMoney(l.declaredValue, s.currency) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink font-semibold"><td /><td className="py-2">Total</td><td className="py-2 pr-2 text-right">{totals.pieces}</td><td /><td className="py-2 text-right">{formatMoney(totals.declaredValue, s.currency)}</td></tr>
          </tfoot>
        </table>
        {missing > 0 && <p className="no-print mt-2 text-xs text-warn-600">{missing} line(s) have no value, so this invoice is incomplete. Customs will usually reject it like this.</p>}
        <p className="mt-6 text-xs text-muted">Values are as declared by the shipper{s.etd ? `. Shipment date ${formatDate(s.etd)}` : ""}. I declare that the information on this invoice is true and correct.</p>
        <div className="mt-10 grid grid-cols-2 gap-8 text-sm"><div><div className="h-14 border-b border-ink" /><p className="mt-1 text-muted">Signature and name</p></div><div><div className="h-14 border-b border-ink" /><p className="mt-1 text-muted">Date</p></div></div>
      </article>
    </>
  );
}
