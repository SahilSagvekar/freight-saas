import { ArrowLeft, ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ManifestButton } from "@/components/app/booking-actions";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { withTenant } from "@/db";
import { describeAttributes } from "@/lib/attributes";
import type { FieldDef } from "@/lib/domain";
import { formatDeparture, KIND_LABEL } from "@/lib/format";
import { can, requirePermission } from "@/server/auth";
import { getVoyage, voyageManifest } from "@/server/queries";
import { formatBookingNo, getTenantConfig } from "@/server/shared";

export default async function VoyagePage({ params }: PageProps<"/app/voyages/[id]">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const loaded = await withTenant(auth.tenantId, async (tx) => ({ v: await getVoyage(tx, id), manifest: await voyageManifest(tx, id), config: await getTenantConfig(tx), types: await tx.itemType.findMany() }));
  if (!loaded.v) notFound();
  const { v, manifest, config } = loaded;
  const schemaById = new Map(loaded.types.map((t) => [t.id, t.fieldSchema as FieldDef[]]));
  const canUpdate = can(auth, "manifest.update");

  return (
    <>
      <PageHeader
        back={<Link href="/app/voyages" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Voyages</Link>}
        title={`${v.originName} → ${v.destinationName}`}
        description={`${formatDeparture(v.departureAt)} · ${v.vesselName}`}
        actions={<><StatusBadge status={v.status} />{can(auth, "booking.create") && (v.status === "SCHEDULED" || v.status === "BOARDING") && <ButtonLink href={`/app/bookings/new?voyage=${v.id}`}><Plus className="size-4" aria-hidden />Add booking</ButtonLink>}</>}
      />
      <Card className="mb-6">
        <div className="grid gap-5 p-5 sm:grid-cols-3">
          <CapacityBar label="Passengers" used={v.used.PASSENGER} capacity={v.capacities.PASSENGER} />
          <CapacityBar label="Vehicles" used={v.used.VEHICLE} capacity={v.capacities.VEHICLE} />
          <CapacityBar label="Cargo" used={v.used.CARGO} capacity={v.capacities.CARGO} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Manifest" description="Everything booked on this sailing." />
        {manifest.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nothing booked yet" description="Confirmed bookings appear on the manifest automatically." />
        ) : (
          <Table>
            <thead><tr><Th>Item</Th><Th>Type</Th><Th>Booking</Th><Th>Status</Th>{canUpdate && <Th className="text-right">Action</Th>}</tr></thead>
            <tbody>
              {manifest.map((m) => (
                <Tr key={m.entryId}>
                  <Td><span className="font-medium">{m.quantity} × {m.description}</span>{(() => { const d = describeAttributes(schemaById.get(m.itemTypeId) ?? [], m.attributes); return d ? <span className="block text-xs text-muted">{d}</span> : null; })()}</Td>
                  <Td className="text-muted">{KIND_LABEL[m.kind]}</Td>
                  <Td><Link href={`/app/bookings/${m.bookingId}`} className="text-brand-700 hover:underline">{formatBookingNo(config, m.bookingNo)}</Link><span className="block text-xs text-muted">{m.contactName}</span></Td>
                  <Td><StatusBadge status={m.status} />{m.receivedBy && <span className="block text-xs text-muted">to {m.receivedBy}</span>}</Td>
                  {canUpdate && <Td className="text-right"><div className="flex justify-end"><ManifestButton entryId={m.entryId} status={m.status} /></div></Td>}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
