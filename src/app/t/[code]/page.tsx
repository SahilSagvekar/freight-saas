import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { TicketSheet } from "@/components/ticket-sheet";
import { adminDb, withTenant } from "@/db";
import { readTicketCode } from "@/lib/ticket-code";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { payTicketAction } from "@/server/public-actions";
import { connectConfigured } from "@/server/stripe";
import { loadTicket } from "@/server/tickets";

export const metadata: Metadata = { title: "Your ticket", robots: { index: false, follow: false } };

/** The link a customer gets by email or text. No sign-in: the signed code in the address is the key. */
export default async function PublicTicketPage({ params, searchParams }: PageProps<"/t/[code]">) {
  const { code } = await params;
  const sp = await searchParams;
  const bookingId = readTicketCode(decodeURIComponent(code));
  if (!bookingId) notFound();
  const owner = await adminDb().booking.findUnique({ where: { id: bookingId }, select: { tenantId: true, source: true, tenant: { select: { stripeAccountId: true } } } });
  if (!owner) notFound();
  const ticket = await withTenant(owner.tenantId, (tx) => loadTicket(tx, owner.tenantId, bookingId));
  if (!ticket) notFound();
  const canPayByCard = owner.source === "PUBLIC" && !!owner.tenant.stripeAccountId && connectConfigured() && ticket.status === "CONFIRMED" && (ticket.paymentStatus === "UNPAID" || ticket.paymentStatus === "PARTIAL");
  const decodedCode = decodeURIComponent(code);
  return (
    <main className="min-h-screen bg-canvas px-4 py-8">
      <div className="no-print mx-auto mb-4 max-w-xl space-y-3">
        {sp.new && <Alert tone="success" title="You're booked!">We&apos;ve emailed this ticket to you too. Keep this page handy.</Alert>}
        {sp.paid && ticket.paymentStatus !== "PAID" && <Alert tone="info" title="Thanks, your payment is being confirmed">This page will show &ldquo;Paid in full&rdquo; in a moment. Refresh to check.</Alert>}
        {sp.pay === "failed" && <Alert tone="warning">We couldn&apos;t open the payment page. You can pay at the ticket desk instead.</Alert>}
        {canPayByCard && (
          <form action={payTicketAction.bind(null, decodedCode)} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">
            <span className="text-sm">Not paid yet. Your seats are held for a short time.</span>
            <Button type="submit">Pay by card</Button>
          </form>
        )}
        <div className="flex justify-end"><PrintButton label="Print or save as PDF" /></div>
      </div>
      <TicketSheet t={ticket} />
    </main>
  );
}
