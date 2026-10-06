import { lockRow, type Tx } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import { validateAttributes } from "@/lib/attributes";
import { checkCapacity, oversellAllowance } from "@/lib/capacity";
import {
  ITEM_KINDS,
  type Capacities,
  type FieldDef,
  KIND_LABELS,
  type BookingSource,
  type BookingStatus,
  type ItemKind,
  type ManifestStatus,
  type PaymentMethod,
} from "@/lib/domain";
import { computeLine, resolveUnitPrice, sumLines, type LineAmounts } from "@/lib/pricing";
import type { CreateBookingInput } from "@/lib/schemas";
import { audit, formatBookingNo, getTenantConfig, nextNumber } from "./shared";

/** A business-rule failure the caller can show to the user (as opposed to a bug). */
export class BookingError extends Error {
  constructor(
    public code:
      | "VOYAGE_NOT_FOUND"
      | "VOYAGE_CLOSED"
      | "ITEM_NOT_FOUND"
      | "NO_PRICE"
      | "INVALID_ATTRIBUTES"
      | "FULL"
      | "NOT_FOUND"
      | "BAD_STATE"
      | "HAS_PAYMENTS"
      | "OVERPAYMENT"
      | "INVALID",
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type Actor = { tenantId: string; actorId: string | null };
export type CreateContext = Actor & { source: BookingSource; clientOpId?: string };

export type CreateBookingResult = {
  bookingId: string;
  bookingNo: string;
  status: BookingStatus;
  reviewReason: string | null;
  total: number;
  currency: string;
  invoiceId: string | null;
};

const OPEN_VOYAGE_STATUSES = ["SCHEDULED", "BOARDING"];

/** Capacity units already sold on a voyage, per kind. Only confirmed bookings count. */
export async function usedCapacity(tx: Tx, voyageId: string): Promise<Record<ItemKind, number>> {
  const rows = await tx.bookingLine.groupBy({
    by: ["kind"],
    where: { booking: { voyageId, status: "CONFIRMED" } },
    _sum: { capacityUnits: true },
  });
  const used: Record<ItemKind, number> = { PASSENGER: 0, VEHICLE: 0, CARGO: 0 };
  for (const row of rows) used[row.kind as ItemKind] = row._sum.capacityUnits ?? 0;
  return used;
}

/**
 * Creates a booking inside the caller's tenant transaction.
 *  - Online bookings must fit real capacity, otherwise they are refused.
 *  - Offline-synced bookings may use a small oversell allowance; beyond it, or if the price changed since
 *    the agent quoted it, they are saved as NEEDS_REVIEW for staff instead of being lost or refused.
 * The voyage row is locked first so two simultaneous sales cannot both take the last space.
 */
export async function createBooking(tx: Tx, ctx: CreateContext, input: CreateBookingInput): Promise<CreateBookingResult> {
  await lockRow(tx, "voyages", input.voyageId);
  const voyage = await tx.voyage.findUnique({ where: { id: input.voyageId } });
  if (!voyage) throw new BookingError("VOYAGE_NOT_FOUND", "That voyage no longer exists");
  if (!OPEN_VOYAGE_STATUSES.includes(voyage.status)) {
    throw new BookingError("VOYAGE_CLOSED", "This voyage is no longer open for booking");
  }

  const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  const vessel = await tx.vessel.findUniqueOrThrow({ where: { id: voyage.vesselId } });
  const config = await getTenantConfig(tx);

  const typeIds = [...new Set(input.lines.map((l) => l.itemTypeId))];
  const types = await tx.itemType.findMany({ where: { id: { in: typeIds }, active: true } });
  const typeById = new Map(types.map((t) => [t.id, t]));
  const rules = await tx.priceRule.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
  const taxes = (await tx.taxRule.findMany({ where: { active: true } })) as Parameters<typeof computeLine>[0]["taxRules"];

  const fieldErrors: Record<string, string> = {};
  const prepared = input.lines.map((line, index) => {
    const type = typeById.get(line.itemTypeId);
    if (!type) throw new BookingError("ITEM_NOT_FOUND", "One of the items is no longer available");

    const attrs = validateAttributes(type.fieldSchema as FieldDef[], line.attributes);
    if (!attrs.ok) {
      for (const [key, message] of Object.entries(attrs.errors)) fieldErrors[`lines.${index}.${key}`] = message;
    }

    const unitPrice = resolveUnitPrice(rules, {
      itemTypeId: type.id,
      originId: voyage.originId,
      destinationId: voyage.destinationId,
    });
    if (unitPrice === null) {
      throw new BookingError("NO_PRICE", `No price is set for ${type.name} on this route`);
    }

    const amounts: LineAmounts = computeLine({ unitPrice, quantity: line.quantity, kind: type.kind as ItemKind, taxRules: taxes });
    return {
      type,
      quantity: line.quantity,
      unitPrice,
      amounts,
      attributes: attrs.ok ? attrs.value : {},
      capacityUnits: type.capacityUnits * line.quantity,
    };
  });
  if (Object.keys(fieldErrors).length > 0) {
    throw new BookingError("INVALID_ATTRIBUTES", "Some item details need attention", fieldErrors);
  }

  const totals = sumLines(prepared.map((p) => p.amounts));

  // Capacity, per kind, against what is already sold.
  const used = await usedCapacity(tx, voyage.id);
  const isOffline = ctx.source === "OFFLINE_SYNC";
  const reviewReasons: string[] = [];
  for (const kind of ITEM_KINDS) {
    const requested = prepared.filter((p) => p.type.kind === kind).reduce((sum, p) => sum + p.capacityUnits, 0);
    if (requested === 0) continue;
    const capacity = (vessel.capacities as Capacities)[kind] ?? 0;
    const verdict = checkCapacity({
      capacity,
      used: used[kind],
      requested,
      allowance: isOffline ? oversellAllowance(capacity, config.oversellPercent) : 0,
    });
    if (verdict.verdict === "FULL") {
      const left = Math.max(0, verdict.remaining);
      if (!isOffline) {
        throw new BookingError("FULL", `Not enough ${KIND_LABELS[kind].toLowerCase()} space on this voyage (${left} left)`);
      }
      reviewReasons.push(`Not enough ${KIND_LABELS[kind].toLowerCase()} space (${left} left when synced)`);
    }
  }
  if (isOffline && input.quotedTotal !== undefined && input.quotedTotal !== totals.total) {
    reviewReasons.push("The price changed after the sale was made offline");
  }

  const status: BookingStatus = reviewReasons.length > 0 ? "NEEDS_REVIEW" : "CONFIRMED";
  const bookingNo = await nextNumber(tx, ctx.tenantId, "booking");

  const booking = await tx.booking.create({
    data: {
      tenantId: ctx.tenantId,
      bookingNo,
      voyageId: voyage.id,
      customerId: input.customerId,
      contactName: input.contactName,
      contactPhone: input.contactPhone || null,
      status,
      reviewReason: reviewReasons.length > 0 ? reviewReasons.join("; ") : null,
      currency: tenant.baseCurrency,
      subtotal: totals.subtotal,
      taxTotal: totals.taxAmount,
      total: totals.total,
      source: ctx.source,
      clientOpId: ctx.clientOpId,
      notes: input.notes || null,
      createdBy: ctx.actorId,
    },
  });

  await tx.bookingLine.createMany({
    data: prepared.map((p) => ({
      tenantId: ctx.tenantId,
      bookingId: booking.id,
      itemTypeId: p.type.id,
      kind: p.type.kind,
      description: p.type.name,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      subtotal: p.amounts.subtotal,
      taxAmount: p.amounts.taxAmount,
      total: p.amounts.total,
      capacityUnits: p.capacityUnits,
      attributes: p.attributes as Prisma.InputJsonObject,
    })),
  });

  let invoiceId: string | null = null;
  if (status === "CONFIRMED") invoiceId = await issueInvoiceAndManifest(tx, ctx, booking.id);

  await audit(tx, {
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    action: status === "CONFIRMED" ? "booking.created" : "booking.flagged",
    entity: "booking",
    entityId: booking.id,
    after: { bookingNo, total: totals.total, source: ctx.source, reviewReasons },
  });

  return {
    bookingId: booking.id,
    bookingNo: formatBookingNo(config, bookingNo),
    status,
    reviewReason: booking.reviewReason,
    total: totals.total,
    currency: tenant.baseCurrency,
    invoiceId,
  };
}

/** Creates the invoice and manifest rows for a booking that has just become confirmed. */
async function issueInvoiceAndManifest(tx: Tx, ctx: Actor, bookingId: string): Promise<string> {
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const lines = await tx.bookingLine.findMany({ where: { bookingId } });

  await tx.manifestEntry.createMany({
    data: lines.map((l) => ({ tenantId: ctx.tenantId, voyageId: booking.voyageId, bookingLineId: l.id })),
    skipDuplicates: true,
  });

  const invoiceNo = await nextNumber(tx, ctx.tenantId, "invoice");
  const invoice = await tx.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceNo,
      bookingId,
      currency: booking.currency,
      subtotal: booking.subtotal,
      taxTotal: booking.taxTotal,
      total: booking.total,
    },
    select: { id: true },
  });
  return invoice.id;
}

async function lockBooking(tx: Tx, bookingId: string) {
  await lockRow(tx, "bookings", bookingId);
  const booking = await tx.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("NOT_FOUND", "Booking not found");
  return booking;
}

/** Staff accept a booking that was flagged during sync (they accept the oversell or the new price). */
export async function approveBooking(tx: Tx, ctx: Actor, bookingId: string) {
  const booking = await lockBooking(tx, bookingId);
  if (booking.status !== "NEEDS_REVIEW") throw new BookingError("BAD_STATE", "This booking is not waiting for review");

  await tx.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } });
  const invoiceId = await issueInvoiceAndManifest(tx, ctx, bookingId);
  await audit(tx, {
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    action: "booking.approved",
    entity: "booking",
    entityId: bookingId,
    before: { status: booking.status, reviewReason: booking.reviewReason },
  });
  return { invoiceId };
}

export async function rejectBooking(tx: Tx, ctx: Actor, bookingId: string, note?: string) {
  const booking = await lockBooking(tx, bookingId);
  if (booking.status !== "NEEDS_REVIEW") throw new BookingError("BAD_STATE", "This booking is not waiting for review");
  const reason = [booking.reviewReason, note ? `Rejected: ${note}` : "Rejected"].filter(Boolean).join(" | ");
  await tx.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED", reviewReason: reason } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "booking.rejected", entity: "booking", entityId: bookingId, before: booking });
}

export async function cancelBooking(tx: Tx, ctx: Actor, bookingId: string) {
  const booking = await lockBooking(tx, bookingId);
  if (booking.status === "CANCELLED") return;

  const invoiceRef = await tx.invoice.findUnique({ where: { bookingId }, select: { id: true } });
  if (invoiceRef) {
    await lockRow(tx, "invoices", invoiceRef.id);
    const paid = await paidTotal(tx, invoiceRef.id);
    if (paid > 0) {
      throw new BookingError("HAS_PAYMENTS", "This booking has payments recorded. Refunds are not supported yet.");
    }
    await tx.invoice.update({ where: { id: invoiceRef.id }, data: { status: "VOID" } });
  }

  await tx.manifestEntry.deleteMany({ where: { bookingLine: { bookingId } } });

  await tx.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "booking.cancelled", entity: "booking", entityId: bookingId, before: { status: booking.status } });
}

export async function recordPayment(
  tx: Tx,
  ctx: Actor,
  invoiceId: string,
  input: { method: PaymentMethod; amount: number; reference?: string },
) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new BookingError("INVALID", "Enter an amount greater than zero");

  await lockRow(tx, "invoices", invoiceId);
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new BookingError("NOT_FOUND", "Invoice not found");
  if (invoice.status === "VOID") throw new BookingError("BAD_STATE", "This invoice is void");

  const paid = await paidTotal(tx, invoiceId);
  const outstanding = invoice.total - paid;
  if (input.amount > outstanding) {
    throw new BookingError("OVERPAYMENT", "That is more than the amount still owed");
  }

  await tx.payment.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceId,
      method: input.method,
      amount: input.amount,
      reference: input.reference || null,
      receivedBy: ctx.actorId,
    },
  });
  const status = paid + input.amount >= invoice.total ? "PAID" : "PARTIAL";
  await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  await audit(tx, {
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    action: "payment.recorded",
    entity: "invoice",
    entityId: invoiceId,
    after: { amount: input.amount, method: input.method, status },
  });
  return { status, outstanding: invoice.total - paid - input.amount };
}

async function paidTotal(tx: Tx, invoiceId: string): Promise<number> {
  const { _sum } = await tx.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
  return _sum.amount ?? 0;
}

const MANIFEST_ORDER: ManifestStatus[] = ["PENDING", "LOADED", "UNLOADED", "DELIVERED"];

export async function setManifestStatus(
  tx: Tx,
  ctx: Actor,
  entryId: string,
  status: ManifestStatus,
  details: { receivedBy?: string; note?: string } = {},
) {
  if (!MANIFEST_ORDER.includes(status)) throw new BookingError("INVALID", "Unknown manifest status");
  await lockRow(tx, "manifest_entries", entryId);
  const entry = await tx.manifestEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new BookingError("NOT_FOUND", "Manifest entry not found");
  if (status === "DELIVERED" && !details.receivedBy?.trim()) {
    throw new BookingError("INVALID", "Enter who received the delivery");
  }

  const now = new Date();
  const index = MANIFEST_ORDER.indexOf(status);
  await tx.manifestEntry.update({
    where: { id: entryId },
    data: {
      status,
      loadedAt: index >= 1 ? (entry.loadedAt ?? now) : null,
      unloadedAt: index >= 2 ? (entry.unloadedAt ?? now) : null,
      deliveredAt: index >= 3 ? now : null,
      receivedBy: status === "DELIVERED" ? details.receivedBy!.trim() : null,
      note: details.note ?? entry.note,
    },
  });
  await audit(tx, {
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    action: "manifest.updated",
    entity: "manifest_entry",
    entityId: entryId,
    before: { status: entry.status },
    after: { status },
  });
}
