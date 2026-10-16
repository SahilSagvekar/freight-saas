import { adminDb, withTenant } from "@/db";
import { billingAccess, type BillingStatus } from "@/lib/billing";
import { cancelBooking } from "./bookings";
import { getTenantConfig } from "./shared";

/** How long an online booking waiting for card payment keeps its seats. Matches the Stripe checkout expiry, plus a little slack. */
export const HOLD_MINUTES = 35;

export type PublicOperator = {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  locale: string;
  timeZone: string;
  stripeAccountId: string | null;
};

/** The operator behind /book/<slug>, or null if there's no such page: unknown, suspended, switched off, or lapsed. */
export async function loadPublicOperator(slug: string): Promise<PublicOperator | null> {
  const t = await adminDb().tenant.findUnique({ where: { slug } });
  if (!t || t.status !== "active") return null;
  const access = billingAccess({ status: t.billingStatus as BillingStatus, trialEndsAt: t.trialEndsAt, currentPeriodEnd: t.currentPeriodEnd, pastDueSince: t.pastDueSince });
  if (access.level !== "full") return null;
  const config = await withTenant(t.id, (tx) => getTenantConfig(tx));
  if (!config.publicBookingEnabled) return null;
  return { id: t.id, name: t.name, slug: t.slug, baseCurrency: t.baseCurrency, locale: t.locale, timeZone: t.timeZone, stripeAccountId: t.stripeAccountId };
}

/**
 * Cancels online bookings that were never paid and have outlived their hold, so abandoned checkouts free their seats.
 * Only bookings from operators who take card payments are touched: "pay at the dock" bookings stay until staff act.
 */
export async function expireUnpaidHolds(opts: { tenantId?: string; now?: Date } = {}): Promise<number> {
  const cutoff = new Date((opts.now ?? new Date()).getTime() - HOLD_MINUTES * 60_000);
  const rows = await adminDb().$queryRaw<{ id: string; tenantId: string }[]>`
    select b.id, b.tenant_id as "tenantId"
    from bookings b
    join tenants t on t.id = b.tenant_id
    join invoices i on i.booking_id = b.id
    where b.source = 'PUBLIC' and b.status = 'CONFIRMED' and b.created_at < ${cutoff}
      and t.stripe_account_id is not null
      and i.status = 'UNPAID' and not exists (select 1 from payments p where p.invoice_id = i.id)
      and (${opts.tenantId ?? null}::uuid is null or b.tenant_id = ${opts.tenantId ?? null}::uuid)
    limit 200`;
  let expired = 0;
  for (const r of rows) {
    try {
      await withTenant(r.tenantId, (tx) => cancelBooking(tx, { tenantId: r.tenantId, actorId: null }, r.id));
      expired += 1;
    } catch (e) {
      console.error("expire hold failed", r.id, e);
    }
  }
  return expired;
}

/** Emails the customer their ticket link. Quietly does nothing if they gave no email or mail isn't set up. */
export async function emailTicket(tenantId: string, bookingId: string, paid: boolean): Promise<void> {
  const [{ loadTicket }, { sendMail }, { ticketEmail }, { ticketCode }, { appBaseUrl }, { formatInZone }] = await Promise.all([
    import("./tickets"),
    import("./mail"),
    import("@/lib/email-templates"),
    import("@/lib/ticket-code"),
    import("./base-url"),
    import("@/lib/tz"),
  ]);
  const data = await withTenant(tenantId, async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { contactEmail: true } });
    const ticket = booking?.contactEmail ? await loadTicket(tx, tenantId, bookingId) : null;
    return booking?.contactEmail && ticket ? { to: booking.contactEmail, ticket } : null;
  });
  if (!data?.ticket.voyage) return;
  const { ticket } = data;
  const base = await appBaseUrl().catch(() => process.env.APP_URL ?? "");
  await sendMail(
    data.to,
    ticketEmail({
      name: ticket.contactName,
      operator: ticket.operatorName,
      route: `${ticket.voyage!.origin} → ${ticket.voyage!.destination}`,
      when: formatInZone(ticket.voyage!.departureAt, ticket.timeZone, ticket.locale),
      bookingNo: ticket.bookingNo,
      url: `${base}/t/${ticketCode(bookingId)}`,
      paid,
    }),
  );
}
