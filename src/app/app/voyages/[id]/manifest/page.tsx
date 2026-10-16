import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { withTenant } from "@/db";
import { describeAttributes } from "@/lib/attributes";
import { KIND_LABELS, type FieldDef } from "@/lib/domain";
import { formatInZone } from "@/lib/tz";
import { requirePermission } from "@/server/auth";
import { getVoyage, voyageManifest } from "@/server/queries";
import { formatBookingNo, getTenantConfig } from "@/server/shared";

export const metadata = { title: "Manifest" };

export default async function PrintManifestPage({ params }: PageProps<"/app/voyages/[id]/manifest">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const loaded = await withTenant(auth.tenantId, async (tx) => ({ v: await getVoyage(tx, id), rows: await voyageManifest(tx, id), config: await getTenantConfig(tx), types: await tx.itemType.findMany() }));
  if (!loaded.v) notFound();
  const { v, rows, config } = loaded;
  const schema = new Map(loaded.types.map((t) => [t.id, t.fieldSchema as FieldDef[]]));
  const totals = { PASSENGER: 0, VEHICLE: 0, CARGO: 0 };
  for (const r of rows) totals[r.kind] += r.quantity;

  return (
    <>
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/app/voyages/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Voyage</Link>
        <div className="flex gap-2">
          <a href={`/api/voyages/${id}/manifest`} className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium shadow-sm hover:bg-canvas">Download CSV</a>
          <PrintButton label="Print manifest" />
        </div>
      </div>
      <article className="rounded-lg border border-line-strong bg-white p-6 text-ink print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink pb-3">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wide">Voyage manifest</h1>
            <p className="text-sm text-muted">{auth.tenant.name}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{v.originName} → {v.destinationName}</p>
            <p className="text-muted">{formatInZone(v.departureAt, auth.tenant.timeZone, auth.tenant.locale)} · {v.vesselName}</p>
            <p className="text-muted">{totals.PASSENGER} passengers · {totals.VEHICLE} vehicles · {totals.CARGO} cargo</p>
          </div>
        </header>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead><tr className="border-b border-ink text-left"><th className="w-8 py-2">✓</th><th className="py-2">Item</th><th className="py-2">Type</th><th className="py-2">Booking</th><th className="py-2">Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.entryId} className="break-inside-avoid border-b border-line align-top">
                <td className="py-2"><span className="inline-block size-4 border border-ink" /></td>
                <td className="py-2"><span className="font-medium">{r.quantity} × {r.description}</span><span className="block text-xs text-muted">{describeAttributes(schema.get(r.itemTypeId) ?? [], r.attributes)}</span></td>
                <td className="py-2 text-muted">{KIND_LABELS[r.kind]}</td>
                <td className="py-2">{formatBookingNo(config, r.bookingNo)}<span className="block text-xs text-muted">{r.contactName}</span></td>
                <td className="py-2 capitalize">{r.status.toLowerCase()}{r.receivedBy ? ` · ${r.receivedBy}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-center text-muted">Nothing booked on this sailing.</p>}
        <footer className="mt-10 grid grid-cols-2 gap-10 text-sm"><div><div className="h-10 border-b border-ink" /><p className="mt-1 text-muted">Master / officer</p></div><div><div className="h-10 border-b border-ink" /><p className="mt-1 text-muted">Dock supervisor</p></div></footer>
      </article>
    </>
  );
}
