import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { TicketSheet } from "@/components/ticket-sheet";
import { withTenant } from "@/db";
import { requirePermission } from "@/server/auth";
import { loadTicket } from "@/server/tickets";

export const metadata = { title: "Ticket" };

export default async function TicketPage({ params }: PageProps<"/app/bookings/[id]/ticket">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ticket = await withTenant(auth.tenantId, (tx) => loadTicket(tx, auth.tenantId, id));
  if (!ticket) notFound();
  return (
    <>
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/app/bookings/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Booking {ticket.bookingNo}</Link>
        <PrintButton label="Print ticket" />
      </div>
      <TicketSheet t={ticket} />
    </>
  );
}
