import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShipmentFormView } from "@/components/app/shipment-form";
import { PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { formFromShipment } from "@/lib/shipment-form";
import { requirePermission } from "@/server/auth";
import { formatShipmentNo } from "@/server/shared";
import { getShipment } from "@/server/shipments";

export const metadata = { title: "Edit shipment" };

export default async function EditShipmentPage({ params }: PageProps<"/app/shipments/[id]/edit">) {
  const auth = await requirePermission("booking.create");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await withTenant(auth.tenantId, (tx) => getShipment(tx, id));
  if (!s) notFound();
  return (
    <>
      <PageHeader back={<Link href={`/app/shipments/${s.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{formatShipmentNo(s.shipmentNo)}</Link>} title={`Edit ${formatShipmentNo(s.shipmentNo)}`} />
      <ShipmentFormView initial={formFromShipment(s)} shipmentId={s.id} currency={s.currency} />
    </>
  );
}
