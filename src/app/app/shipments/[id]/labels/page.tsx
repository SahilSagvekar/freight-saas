import { notFound } from "next/navigation";
import { DocToolbar } from "@/components/app/doc-parts";
import { QrCode } from "@/components/qr-code";
import { withTenant } from "@/db";
import { labelPieces } from "@/lib/shipment";
import { trackingCode } from "@/lib/tracking-code";
import { requirePermission } from "@/server/auth";
import { appBaseUrl } from "@/server/base-url";
import { loadShipmentDoc } from "@/server/shipment-docs";
import { formatShipmentNo } from "@/server/shared";

export const metadata = { title: "Cargo labels" };

export default async function LabelsPage({ params }: PageProps<"/app/shipments/[id]/labels">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await withTenant(auth.tenantId, (tx) => loadShipmentDoc(tx, auth.tenant.name, id));
  if (!d) notFound();
  const { s, lines } = d;
  const { pieces, total, truncated } = labelPieces(lines);
  const url = `${await appBaseUrl()}/track/${encodeURIComponent(trackingCode(s.id))}`;
  const consignee = d.consignee;

  return (
    <>
      {/* One label per page at 100 × 150 mm, the common thermal label. On other printers choose "fit to page". */}
      <style>{`@media print { @page { size: 100mm 150mm; margin: 0 } main { padding: 0 !important } }`}</style>
      <DocToolbar backHref={`/app/shipments/${s.id}`} backLabel={formatShipmentNo(s.shipmentNo)} printLabel={`Print ${pieces.length} label${pieces.length === 1 ? "" : "s"}`} />
      {truncated && <p className="no-print mb-4 text-sm text-warn-600">This shipment has {total} pieces. Only the first {pieces.length} labels are shown.</p>}
      <p className="no-print mb-4 text-sm text-muted">Labels are 100 × 150 mm, one per piece. Each QR code opens the shipment&apos;s tracking page.</p>
      <div className="flex flex-wrap gap-4 print:block">
        {pieces.map((p) => (
          <section key={p.n} className="flex h-[150mm] w-[100mm] flex-col justify-between border-2 border-ink bg-white p-4 text-ink [break-after:page] print:border-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{d.company.name}</p>
              <p className="mt-1 text-xs uppercase text-muted">Deliver to</p>
              <p className="text-xl font-bold leading-tight">{consignee.name}</p>
              <p className="whitespace-pre-line text-sm">{consignee.address}</p>
              {consignee.phone && <p className="text-sm">Tel {consignee.phone}</p>}
            </div>
            <div className="border-y-2 border-ink py-2">
              <p className="text-xs uppercase text-muted">To</p>
              <p className="text-2xl font-bold leading-tight">{s.destination}</p>
              <p className="text-xs text-muted">From {s.origin}</p>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="font-mono text-lg font-bold">{formatShipmentNo(s.shipmentNo)}</p>
                {s.houseNo && <p className="font-mono text-xs">{s.houseNo}</p>}
                {s.customerRef && <p className="text-xs">Ref {s.customerRef}</p>}
                <p className="mt-1 truncate text-xs">{p.packageType}: {p.description}</p>
                {p.marks && <p className="text-xs">{p.marks}</p>}
                <p className="mt-2 text-3xl font-bold">{p.n} <span className="text-lg font-medium text-muted">of {p.of}</span></p>
              </div>
              <QrCode value={url} size={110} label={`Track ${formatShipmentNo(s.shipmentNo)}`} />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
