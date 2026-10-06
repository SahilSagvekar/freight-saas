import { PageHeader } from "@/components/ui/page";
import { Desk } from "@/components/app/desk";
import { requirePermission } from "@/server/auth";

export const metadata = { title: "Ticket desk" };

export default async function DeskPage() {
  const auth = await requirePermission("booking.create");
  return (
    <>
      <PageHeader title="Ticket desk" description="Works without a connection. Sales are saved on this device and upload when you're back online." />
      <Desk tenantId={auth.tenantId} />
    </>
  );
}
