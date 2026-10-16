"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/db";
import { PAYMENT_METHODS, type ManifestStatus, type PaymentMethod } from "@/lib/domain";
import { toMinor } from "@/lib/money";
import { readTicketCode } from "@/lib/ticket-code";
import { createBookingSchema } from "@/lib/schemas";
import { can, requirePermission, requireWrite } from "./auth";
import { formatBookingNo, getTenantConfig } from "./shared";
import { approveBooking, BookingError, cancelBooking, createBooking, recordPayment, refundPayment, rejectBooking, setManifestStatus } from "./bookings";

export type ActionResult<T = unknown> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fields?: Record<string, string> };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message, fields: e.fields };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function createBookingAction(raw: unknown): Promise<ActionResult<{ bookingId: string; bookingNo: string; status: string; reviewReason: string | null }>> {
  const auth = await requireWrite("booking.create");
  const parsed = createBookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const result = await run(() =>
    withTenant(auth.tenantId, (tx) => createBooking(tx, { tenantId: auth.tenantId, actorId: auth.userId, source: "ONLINE" }, parsed.data)),
  );
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  const d = result.data as { bookingId: string; bookingNo: string; status: string; reviewReason: string | null };
  return { ok: true, data: d };
}

export async function cancelBookingAction(bookingId: string, refundMethod?: string): Promise<ActionResult> {
  const auth = await requireWrite("booking.cancel");
  const ctx = { tenantId: auth.tenantId, actorId: auth.userId };
  let refund: { method: PaymentMethod } | undefined;
  if (refundMethod) {
    // Handing money back is its own permission, so a cancel button can't also empty the till.
    if (!can(auth, "payment.refund")) return { ok: false, error: "You don't have permission to refund payments." };
    if (!PAYMENT_METHODS.includes(refundMethod as PaymentMethod)) return { ok: false, error: "Choose how the refund is paid." };
    refund = { method: refundMethod as PaymentMethod };
  }
  const result = await run(() => withTenant(auth.tenantId, (tx) => cancelBooking(tx, ctx, bookingId, { refund })));
  revalidatePath("/app", "layout");
  return result;
}

export async function refundAction(input: { invoiceId: string; currency: string; amount: string; method: string; reason: string }): Promise<ActionResult> {
  const auth = await requireWrite("payment.refund");
  const minor = toMinor(input.amount, input.currency);
  if (minor === null || minor <= 0) return { ok: false, error: "Enter a valid amount, for example 25.00" };
  if (!PAYMENT_METHODS.includes(input.method as PaymentMethod)) return { ok: false, error: "Choose how the refund is paid" };
  const result = await run(() =>
    withTenant(auth.tenantId, (tx) => refundPayment(tx, { tenantId: auth.tenantId, actorId: auth.userId }, input.invoiceId, { method: input.method as PaymentMethod, amount: minor, reason: input.reason })),
  );
  revalidatePath("/app", "layout");
  return result;
}

export async function reviewBookingAction(bookingId: string, decision: "approve" | "reject", note?: string): Promise<ActionResult> {
  const auth = await requireWrite("booking.review");
  const ctx = { tenantId: auth.tenantId, actorId: auth.userId };
  const result = await run(() =>
    withTenant(auth.tenantId, async (tx) => {
      if (decision === "approve") await approveBooking(tx, ctx, bookingId);
      else await rejectBooking(tx, ctx, bookingId, note);
    }),
  );
  revalidatePath("/app", "layout");
  return result;
}

export async function recordPaymentAction(input: { invoiceId: string; currency: string; amount: string; method: string; reference?: string }): Promise<ActionResult> {
  const auth = await requireWrite("payment.record");
  const minor = toMinor(input.amount, input.currency);
  if (minor === null || minor <= 0) return { ok: false, error: "Enter a valid amount, for example 25.00" };
  if (!PAYMENT_METHODS.includes(input.method as PaymentMethod)) return { ok: false, error: "Choose a payment method" };
  const result = await run(() =>
    withTenant(auth.tenantId, (tx) =>
      recordPayment(tx, { tenantId: auth.tenantId, actorId: auth.userId }, input.invoiceId, {
        method: input.method as PaymentMethod,
        amount: minor,
        reference: input.reference?.trim() || undefined,
      }),
    ),
  );
  revalidatePath("/app", "layout");
  return result;
}

export async function manifestAction(entryId: string, status: ManifestStatus, receivedBy?: string): Promise<ActionResult> {
  const auth = await requireWrite("manifest.update");
  const result = await run(() => withTenant(auth.tenantId, (tx) => setManifestStatus(tx, { tenantId: auth.tenantId, actorId: auth.userId }, entryId, status, { receivedBy })));
  revalidatePath("/app", "layout");
  return result;
}


export type CheckinLine = { entryId: string; description: string; quantity: number; kind: string; status: ManifestStatus };
export type CheckinResult = {
  bookingId: string;
  bookingNo: string;
  contactName: string;
  bookingStatus: string;
  paymentStatus: string;
  route: string;
  departureAt: string;
  voyageStatus: string;
  lines: CheckinLine[];
};

/** Reads a scanned (or typed) ticket code and shows what is on that booking. Read-only; boarding is a separate step. */
export async function lookupTicketAction(code: string): Promise<ActionResult<CheckinResult>> {
  const auth = await requirePermission("manifest.update");
  const bookingId = readTicketCode(code);
  if (!bookingId) return { ok: false, error: "That isn't a valid ticket code." };
  const found = await withTenant(auth.tenantId, async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { voyage: { include: { origin: { select: { name: true } }, destination: { select: { name: true } } } }, invoice: { select: { status: true } }, lines: { include: { manifestEntry: true } } } });
    if (!booking) return null;
    const config = await getTenantConfig(tx);
    return {
      bookingId: booking.id,
      bookingNo: formatBookingNo(config, booking.bookingNo),
      contactName: booking.contactName,
      bookingStatus: booking.status,
      paymentStatus: booking.invoice?.status ?? "NONE",
      route: `${booking.voyage.origin.name} → ${booking.voyage.destination.name}`,
      departureAt: booking.voyage.departureAt.toISOString(),
      voyageStatus: booking.voyage.status,
      lines: booking.lines.filter((l) => l.manifestEntry).map((l) => ({ entryId: l.manifestEntry!.id, description: l.description, quantity: l.quantity, kind: l.kind, status: l.manifestEntry!.status as ManifestStatus })),
    };
  });
  if (!found) return { ok: false, error: "Ticket not found for this operator." };
  return { ok: true, data: found };
}

/** Boards everything on a booking that is still waiting (marks it loaded). Safe to press twice. */
export async function boardBookingAction(bookingId: string): Promise<ActionResult<{ boarded: number }>> {
  const auth = await requireWrite("manifest.update");
  const ctx = { tenantId: auth.tenantId, actorId: auth.userId };
  const result = await run(() =>
    withTenant(auth.tenantId, async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { voyage: { select: { status: true } }, lines: { include: { manifestEntry: true } } } });
      if (!booking) throw new BookingError("NOT_FOUND", "Booking not found");
      if (booking.status !== "CONFIRMED") throw new BookingError("BAD_STATE", "This booking isn't confirmed, so it can't board.");
      if (booking.voyage.status === "CANCELLED" || booking.voyage.status === "ARRIVED") throw new BookingError("BAD_STATE", `This voyage is ${booking.voyage.status.toLowerCase()}.`);
      let boarded = 0;
      for (const line of booking.lines) {
        const entry = line.manifestEntry;
        if (entry && entry.status === "PENDING") {
          await setManifestStatus(tx, ctx, entry.id, "LOADED");
          boarded += 1;
        }
      }
      return { boarded };
    }),
  );
  revalidatePath("/app", "layout");
  return result;
}
