"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb, withTenant } from "@/db";
import { createBookingSchema } from "@/lib/schemas";
import { readTicketCode, ticketCode } from "@/lib/ticket-code";
import type { ActionResult } from "./booking-actions";
import { appBaseUrl } from "./base-url";
import { BookingError, createBooking } from "./bookings";
import { emailTicket, expireUnpaidHolds, loadPublicOperator } from "./public-booking";
import { formatBookingNo, getTenantConfig } from "./shared";
import { connectConfigured, createTicketCheckout, StripeError } from "./stripe";
import { throttle } from "./throttle";

async function startCheckout(op: { stripeAccountId: string | null; slug: string }, booking: { id: string; bookingNo: string; total: number; currency: string; email: string | null; description: string }): Promise<string | null> {
  if (!op.stripeAccountId || !connectConfigured() || booking.total <= 0) return null;
  const base = await appBaseUrl();
  const code = ticketCode(booking.id);
  try {
    const s = await createTicketCheckout({
      account: op.stripeAccountId,
      bookingId: booking.id,
      bookingNo: booking.bookingNo,
      amount: booking.total,
      currency: booking.currency,
      email: booking.email ?? undefined,
      successUrl: `${base}/t/${code}?paid=1`,
      cancelUrl: `${base}/t/${code}`,
      description: booking.description,
    });
    return s.url;
  } catch (e) {
    if (e instanceof StripeError) console.error("ticket checkout failed", e.message);
    else throw e;
    return null;
  }
}

/**
 * The public "book a ticket" submit. Takes the same form as the staff screen, but:
 *  - the tenant comes from the page's slug, never from the request body
 *  - seats are strictly checked (no oversell, no review queue)
 *  - the customer is sent on to card payment if the operator takes cards, else to their ticket ("pay at the dock").
 */
export async function createPublicBookingAction(slug: string, raw: unknown): Promise<ActionResult<never>> {
  const op = await loadPublicOperator(slug);
  if (!op) return { ok: false, error: "Online booking isn't available right now." };

  const parsed = createBookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  if (!parsed.data.contactEmail) return { ok: false, error: "Enter your email so we can send your ticket." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await throttle(`public-book:${op.id}:${ip}`, 10, 60 * 60 * 1000)).allowed) return { ok: false, error: "Too many bookings from this connection. Please try again later." };

  await expireUnpaidHolds({ tenantId: op.id });

  // The customer chooses what to buy, never the price: quotedTotal and customer links are not accepted from the public.
  const { quotedTotal: _quoted, customerId: _customer, ...input } = parsed.data;
  void _quoted;
  void _customer;

  let made;
  try {
    made = await withTenant(op.id, (tx) => createBooking(tx, { tenantId: op.id, actorId: null, source: "PUBLIC" }, input));
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message, fields: e.fields };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  const checkout = await startCheckout(op, { id: made.bookingId, bookingNo: made.bookingNo, total: made.total, currency: op.baseCurrency, email: input.contactEmail ?? null, description: input.contactName });
  if (checkout) redirect(checkout);
  // Pay at the dock: the ticket is valid now, so email it straight away.
  void emailTicket(op.id, made.bookingId, false).catch((e) => console.error("ticket email failed", e));
  redirect(`/t/${ticketCode(made.bookingId)}?new=1`);
}

/** "Pay by card" on the ticket page, for someone who closed the payment window or whose checkout failed. */
export async function payTicketAction(code: string): Promise<void> {
  const bookingId = readTicketCode(code);
  if (!bookingId) redirect("/");
  const found = await adminDb().booking.findUnique({ where: { id: bookingId }, include: { tenant: true, invoice: true } });
  if (!found || found.source !== "PUBLIC" || found.status !== "CONFIRMED" || !found.invoice || found.invoice.status === "PAID" || found.invoice.status === "VOID") redirect(`/t/${code}`);
  if (!(await throttle(`pay-ticket:${bookingId}`, 6, 60 * 60 * 1000)).allowed) redirect(`/t/${code}`);
  const paid = await adminDb().payment.aggregate({ where: { invoiceId: found.invoice.id }, _sum: { amount: true } });
  const owed = found.invoice.total - (paid._sum.amount ?? 0);
  const config = await withTenant(found.tenantId, (tx) => getTenantConfig(tx));
  const url = await startCheckout(
    { stripeAccountId: found.tenant.stripeAccountId, slug: found.tenant.slug },
    { id: found.id, bookingNo: formatBookingNo(config, found.bookingNo), total: owed, currency: found.currency, email: found.contactEmail, description: found.contactName },
  );
  redirect(url ?? `/t/${code}?pay=failed`);
}
