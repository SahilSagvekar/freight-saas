import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShipmentStatusBadge } from "@/components/app/shipment-status";
import { adminDb, withTenant } from "@/db";
import { MODE_LABELS, type TransportMode } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/lib/shipment";
import { readTrackingCode } from "@/lib/tracking-code";
import { formatShipmentNo } from "@/server/shared";

export const metadata: Metadata = { title: "Track your shipment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The link a customer gets by email or from the QR code on a label. No sign-in: the signed code is the key.
 * Shows status, route, dates and movement only. Never parties, prices, documents or internal notes.
 */
export default async function TrackPage({ params }: PageProps<"/track/[code]">) {
  const { code } = await params;
  const id = readTrackingCode(decodeURIComponent(code));
  if (!id) notFound();
  const owner = await adminDb().shipment.findUnique({ where: { id }, select: { tenantId: true, tenant: { select: { name: true, status: true } } } });
  if (!owner || owner.tenant.status !== "active") notFound();
  const s = await withTenant(owner.tenantId, (tx) => tx.shipment.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: "desc" } }, packages: { select: { quantity: true } } } }));
  if (!s) notFound();
  const pieces = s.packages.reduce((n, p) => n + p.quantity, 0);

  return (
    <main className="min-h-screen bg-canvas px-4 py-8">
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-sm text-muted">{owner.tenant.name}</p>
        <div className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-mono text-xl font-semibold">{formatShipmentNo(s.shipmentNo)}</h1>
              <p className="text-sm text-muted">{MODE_LABELS[s.mode as TransportMode] ?? s.mode} freight · {pieces} piece{pieces === 1 ? "" : "s"}</p>
            </div>
            <ShipmentStatusBadge status={s.status} />
          </div>
          <p className="mt-4 text-lg font-medium">{s.origin} → {s.destination}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Departs</dt><dd className="font-medium">{s.etd ? formatDate(s.etd) : "To be confirmed"}</dd></div>
            <div><dt className="text-muted">Arrives</dt><dd className="font-medium">{s.eta ? formatDate(s.eta) : "To be confirmed"}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Progress</h2>
          <ol className="divide-y divide-line text-sm">
            {s.events.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <p className="font-medium">{SHIPMENT_STATUS_LABELS[e.status as ShipmentStatus] ?? e.status}{e.location ? ` · ${e.location}` : ""}</p>
                <p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
