"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/db";
import { PAYMENT_METHODS, type ManifestStatus, type PaymentMethod } from "@/lib/domain";
import { toMinor } from "@/lib/money";
import { createBookingSchema } from "@/lib/schemas";
import { requirePermission } from "./auth";
import { approveBooking, BookingError, cancelBooking, createBooking, recordPayment, rejectBooking, setManifestStatus } from "./bookings";

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
  const auth = await requirePermission("booking.create");
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

export async function cancelBookingAction(bookingId: string): Promise<ActionResult> {
  const auth = await requirePermission("booking.cancel");
  const result = await run(() => withTenant(auth.tenantId, (tx) => cancelBooking(tx, { tenantId: auth.tenantId, actorId: auth.userId }, bookingId)));
  revalidatePath("/app", "layout");
  return result;
}

export async function reviewBookingAction(bookingId: string, decision: "approve" | "reject", note?: string): Promise<ActionResult> {
  const auth = await requirePermission("booking.review");
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
  const auth = await requirePermission("payment.record");
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
  const auth = await requirePermission("manifest.update");
  const result = await run(() => withTenant(auth.tenantId, (tx) => setManifestStatus(tx, { tenantId: auth.tenantId, actorId: auth.userId }, entryId, status, { receivedBy })));
  revalidatePath("/app", "layout");
  return result;
}

