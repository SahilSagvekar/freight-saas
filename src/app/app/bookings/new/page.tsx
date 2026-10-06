import { PageHeader } from "@/components/ui/page";
import { BookingFormClient } from "./client";
import { withTenant } from "@/db";
import { requirePermission } from "@/server/auth";
import { bookingFormData } from "@/server/queries";

export const metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: PageProps<"/app/bookings/new">) {
  const auth = await requirePermission("booking.create");
  const { voyage } = await searchParams;
  const data = await withTenant(auth.tenantId, bookingFormData);
  return (
    <>
      <PageHeader title="New booking" description="Passengers, vehicles and cargo on one booking." />
      <BookingFormClient data={data} currency={auth.tenant.baseCurrency} locale={auth.tenant.locale} initialVoyageId={typeof voyage === "string" ? voyage : undefined} />
    </>
  );
}
