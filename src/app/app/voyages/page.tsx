import { Plus, Ship } from "lucide-react";
import { VoyageCard } from "@/components/app/voyage-card";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { can, requirePermission } from "@/server/auth";
import { listUpcomingVoyages } from "@/server/queries";

export const metadata = { title: "Voyages" };

export default async function VoyagesPage() {
  const auth = await requirePermission("booking.view");
  const voyages = await withTenant(auth.tenantId, (tx) => listUpcomingVoyages(tx, { limit: 60 }));
  return (
    <>
      <PageHeader
        title="Voyages"
        description="Upcoming sailings and how full they are."
        actions={can(auth, "voyage.manage") && <ButtonLink href="/app/voyages/new"><Plus className="size-4" aria-hidden />Schedule voyage</ButtonLink>}
      />
      {voyages.length === 0 ? (
        <Card><EmptyState icon={Ship} title="No upcoming voyages" description="Schedule your first voyage to start taking bookings." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{voyages.map((v) => <VoyageCard key={v.id} v={v} />)}</div>
      )}
    </>
  );
}
