import { Package, Plus } from "lucide-react";
import Link from "next/link";
import { ShipmentStatusBadge } from "@/components/app/shipment-status";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { withTenant } from "@/db";
import { MODE_LABELS, type TransportMode } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { packageTotals } from "@/lib/shipment";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth";
import { formatShipmentNo } from "@/server/shared";
import { listShipments, shipmentCounts } from "@/server/shipments";

export const metadata = { title: "Shipments" };

const TABS = [
  { key: "active", label: "Active" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const auth = await requirePermission("booking.view");
  const tab = TABS.find((t) => t.key === status)?.key;
  const search = q?.trim().slice(0, 80) || undefined;
  const { rows, counts } = await withTenant(auth.tenantId, async (tx) => ({ rows: await listShipments(tx, { status: tab, q: search }), counts: await shipmentCounts(tx) }));
  const countFor = (k: string) => (k === "active" ? counts.active : counts.by[k] ?? 0);
  const pill = "rounded-full px-3 py-1.5 text-sm font-medium transition-colors";
  const canCreate = auth.permissions.has("booking.create");

  return (
    <>
      <PageHeader title="Shipments" description="Every job from booking to delivery." actions={canCreate ? <ButtonLink href="/app/shipments/new"><Plus className="size-4" aria-hidden />New shipment</ButtonLink> : undefined} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
          <Link href="/app/shipments" aria-current={!tab ? "page" : undefined} className={cn(pill, !tab ? "bg-brand-600 text-white" : "bg-line/70 text-muted hover:text-ink")}>All ({counts.all})</Link>
          {TABS.map((t) => (
            <Link key={t.key} href={`/app/shipments?status=${t.key}`} aria-current={tab === t.key ? "page" : undefined} className={cn(pill, tab === t.key ? "bg-brand-600 text-white" : "bg-line/70 text-muted hover:text-ink")}>{t.label} ({countFor(t.key)})</Link>
          ))}
        </nav>
        <form className="flex gap-2" role="search">
          {tab && <input type="hidden" name="status" value={tab} />}
          <input name="q" defaultValue={search} placeholder="Search number, reference, container…" aria-label="Search shipments" className="h-9 w-64 rounded-md border border-line bg-white px-3 text-sm" />
          <button className="h-9 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-line/50">Search</button>
        </form>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Package} title={search ? "No shipments match that search" : "No shipments yet"} description={search ? "Try a shipment number, container number, reference or city." : "Create one here, or convert an inquiry from your website form."} />
        ) : (
          <Table>
            <thead><tr><Th>Shipment</Th><Th>Route</Th><Th>Goods</Th><Th>Status</Th><Th>ETD</Th><Th>ETA</Th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const t = packageTotals(r.packages.map((p) => ({ quantity: p.quantity, packageType: "", description: "", lengthCm: null, widthCm: null, heightCm: null, grossWeightKg: p.grossWeightKg, marks: null, hsCode: null, declaredValue: null })));
                return (
                  <Tr key={r.id}>
                    <Td><Link className="font-medium text-brand-700 hover:underline" href={`/app/shipments/${r.id}`}>{formatShipmentNo(r.shipmentNo)}</Link><span className="block text-xs text-muted">{MODE_LABELS[r.mode as TransportMode] ?? r.mode}{r.customerRef ? ` · ${r.customerRef}` : ""}</span></Td>
                    <Td>{r.origin} → {r.destination}</Td>
                    <Td><span className="line-clamp-1">{r.goods}</span><span className="text-xs text-muted">{t.pieces} pcs{t.grossKg ? ` · ${t.grossKg} kg` : ""}</span></Td>
                    <Td><ShipmentStatusBadge status={r.status} /></Td>
                    <Td className="text-muted">{r.etd ? formatDate(r.etd) : "—"}</Td>
                    <Td className="text-muted">{r.eta ? formatDate(r.eta) : "—"}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
