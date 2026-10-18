import { notFound } from "next/navigation";
import { Box, DocToolbar, DOC_SHEET, Letterhead, PartyBlock } from "@/components/app/doc-parts";
import { withTenant } from "@/db";
import { formatDate } from "@/lib/format";
import { TRANSPORT_DOC_TITLE, type ShipmentMode } from "@/lib/shipment";
import { requirePermission } from "@/server/auth";
import { loadShipmentDoc } from "@/server/shipment-docs";
import { formatShipmentNo } from "@/server/shared";

export const metadata = { title: "Bill of Lading" };

export default async function BillOfLadingPage({ params }: PageProps<"/app/shipments/[id]/bol">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await withTenant(auth.tenantId, (tx) => loadShipmentDoc(tx, auth.tenant.name, id));
  if (!d) notFound();
  const { s, lines, totals } = d;
  const air = s.mode === "AIR";
  const title = TRANSPORT_DOC_TITLE[s.mode as ShipmentMode] ?? "Bill of Lading";
  const docNo = s.houseNo || formatShipmentNo(s.shipmentNo);

  return (
    <>
      <DocToolbar backHref={`/app/shipments/${s.id}`} backLabel={formatShipmentNo(s.shipmentNo)} printLabel={`Print ${title.toLowerCase()}`} />
      <article className={DOC_SHEET}>
        <Letterhead company={d.company} title={title} number={docNo} sub={s.houseNo ? `Shipment ${formatShipmentNo(s.shipmentNo)}` : undefined} />
        <div className="mt-4 grid grid-cols-2 gap-0 [&>*]:-mt-px [&>*]:-ml-px">
          <Box label="Shipper"><PartyBlock party={d.shipper} /></Box>
          <Box label={air ? "House AWB no." : "Bill of lading no."}><span className="font-mono">{docNo}</span></Box>
          <Box label="Consignee"><PartyBlock party={d.consignee} /></Box>
          <Box label={air ? "Master AWB no." : "Master B/L no."}><span className="font-mono">{s.masterNo || "—"}</span></Box>
          <Box label="Notify party"><PartyBlock party={d.notify} /></Box>
          <Box label="Carrier">{s.carrier || "—"}</Box>
          <Box label={air ? "Airport of departure" : "Port or place of loading"}>{s.origin}</Box>
          <Box label={air ? "Flight" : "Vessel and voyage"}>{[s.vesselOrFlight, s.voyageNo].filter(Boolean).join(" ") || "—"}</Box>
          <Box label={air ? "Airport of destination" : "Port or place of discharge"}>{s.destination}</Box>
          <Box label="Sailing or departure date (ETD)">{s.etd ? formatDate(s.etd) : "—"}</Box>
          {!air && <Box label="Container and seal no.">{[s.containerNo, s.sealNo && `Seal ${s.sealNo}`].filter(Boolean).join(" / ") || "—"}</Box>}
          <Box label="Incoterm">{s.incoterm || "—"}</Box>
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-ink text-left text-xs uppercase tracking-wide">
              <th className="w-40 py-2 pr-3">Marks and numbers</th>
              <th className="w-24 py-2 pr-3">Packages</th>
              <th className="py-2 pr-3">Description of goods</th>
              <th className="w-28 py-2 pr-3 text-right">Gross weight</th>
              <th className="w-24 py-2 text-right">Measurement</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="py-1.5 pr-3 text-xs">{l.marks || (i === 0 ? s.marks : "") || ""}</td>
                <td className="py-1.5 pr-3">{l.quantity} {l.packageType}</td>
                <td className="py-1.5 pr-3">{l.description}{l.hsCode ? <span className="block text-xs text-muted">HS {l.hsCode}</span> : null}</td>
                <td className="py-1.5 pr-3 text-right">{l.grossWeightKg ? `${l.grossWeightKg} kg` : ""}</td>
                <td className="py-1.5 text-right">{l.lengthCm && l.widthCm && l.heightCm ? `${Math.round((l.quantity * l.lengthCm * l.widthCm * l.heightCm) / 10000) / 100} m³` : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink font-semibold">
              <td className="py-2 pr-3" />
              <td className="py-2 pr-3">{totals.pieces} total</td>
              <td className="py-2 pr-3 text-xs font-normal text-muted">Said to contain: {s.goods}</td>
              <td className="py-2 pr-3 text-right">{totals.grossKg ? `${totals.grossKg} kg` : ""}</td>
              <td className="py-2 text-right">{totals.cbm ? `${totals.cbm} m³` : ""}</td>
            </tr>
          </tfoot>
        </table>
        {totals.linesWithoutWeight > 0 && <p className="no-print mt-2 text-xs text-warn-600">{totals.linesWithoutWeight} package line(s) have no weight, so the total is incomplete. Edit the shipment to add it before you print.</p>}

        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div><div className="h-14 border-b border-ink" /><p className="mt-1 text-muted">Signed for the carrier</p><p className="mt-3 text-muted">Place and date of issue: ____________________</p></div>
          <div><div className="h-14 border-b border-ink" /><p className="mt-1 text-muted">Received by consignee</p><p className="mt-3 text-muted">Date: ____________________</p></div>
        </div>
        {d.terms && <p className="mt-8 whitespace-pre-line border-t border-line pt-3 text-[10px] leading-snug text-muted">{d.terms}</p>}
      </article>
    </>
  );
}
