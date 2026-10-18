import { notFound } from "next/navigation";
import { Box, DocToolbar, DOC_SHEET, Letterhead, PartyBlock } from "@/components/app/doc-parts";
import { withTenant } from "@/db";
import { formatDate } from "@/lib/format";
import { lineVolumeCbm } from "@/lib/shipment";
import { requirePermission } from "@/server/auth";
import { loadShipmentDoc } from "@/server/shipment-docs";
import { formatShipmentNo } from "@/server/shared";

export const metadata = { title: "Packing list" };

export default async function PackingListPage({ params }: PageProps<"/app/shipments/[id]/packing-list">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await withTenant(auth.tenantId, (tx) => loadShipmentDoc(tx, auth.tenant.name, id));
  if (!d) notFound();
  const { s, lines, totals } = d;

  return (
    <>
      <DocToolbar backHref={`/app/shipments/${s.id}`} backLabel={formatShipmentNo(s.shipmentNo)} printLabel="Print packing list" />
      <article className={DOC_SHEET}>
        <Letterhead company={d.company} title="Packing list" number={formatShipmentNo(s.shipmentNo)} sub={s.customerRef ? `Your ref. ${s.customerRef}` : undefined} />
        <div className="mt-4 grid grid-cols-2 [&>*]:-mt-px [&>*]:-ml-px">
          <Box label="Shipper"><PartyBlock party={d.shipper} /></Box>
          <Box label="Consignee"><PartyBlock party={d.consignee} /></Box>
          <Box label="From">{s.origin}</Box>
          <Box label="To">{s.destination}</Box>
          <Box label="Carrier and vessel or flight">{[s.carrier, s.vesselOrFlight, s.voyageNo].filter(Boolean).join(" · ") || "—"}</Box>
          <Box label="Date shipped (ETD)">{s.etd ? formatDate(s.etd) : "—"}</Box>
        </div>
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-ink text-left text-xs uppercase tracking-wide">
              <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Pieces</th><th className="py-2 pr-2">Type</th><th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2">Size (cm)</th><th className="py-2 pr-2 text-right">Gross kg</th><th className="py-2 pr-2 text-right">m³</th><th className="py-2">Marks</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-1.5 pr-2 text-muted">{i + 1}</td>
                <td className="py-1.5 pr-2 font-medium">{l.quantity}</td>
                <td className="py-1.5 pr-2">{l.packageType}</td>
                <td className="py-1.5 pr-2">{l.description}</td>
                <td className="py-1.5 pr-2 whitespace-nowrap">{l.lengthCm && l.widthCm && l.heightCm ? `${l.lengthCm} × ${l.widthCm} × ${l.heightCm}` : ""}</td>
                <td className="py-1.5 pr-2 text-right">{l.grossWeightKg ?? ""}</td>
                <td className="py-1.5 pr-2 text-right">{lineVolumeCbm(l) || ""}</td>
                <td className="py-1.5 text-xs">{l.marks}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink font-semibold">
              <td className="py-2 pr-2" /><td className="py-2 pr-2">{totals.pieces}</td><td className="py-2 pr-2" /><td className="py-2 pr-2">Total</td><td className="py-2 pr-2" />
              <td className="py-2 pr-2 text-right">{totals.grossKg || ""}</td><td className="py-2 pr-2 text-right">{totals.cbm || ""}</td><td />
            </tr>
          </tfoot>
        </table>
        {totals.linesWithoutWeight > 0 && <p className="no-print mt-2 text-xs text-warn-600">{totals.linesWithoutWeight} line(s) have no weight, so the total is incomplete.</p>}
        <p className="mt-6 text-sm"><span className="text-muted">Goods:</span> {s.goods}</p>
      </article>
    </>
  );
}
