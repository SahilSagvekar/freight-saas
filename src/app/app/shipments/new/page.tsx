import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ShipmentFormView } from "@/components/app/shipment-form";
import { PageHeader } from "@/components/ui/page";
import { emptyShipmentForm } from "@/lib/shipment-form";
import { requirePermission } from "@/server/auth";

export const metadata = { title: "New shipment" };

export default async function NewShipmentPage() {
  const auth = await requirePermission("booking.create");
  return (
    <>
      <PageHeader back={<Link href="/app/shipments" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />All shipments</Link>} title="New shipment" />
      <ShipmentFormView initial={emptyShipmentForm()} shipmentId={null} currency={auth.tenant.baseCurrency} />
    </>
  );
}
