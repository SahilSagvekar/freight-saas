import type { Tx } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import { canMoveQuote, computeTotals, QUOTE_STATUS_LABELS, QUOTE_STATUSES, type QuoteStatus } from "@/lib/freight-billing";
import type { QuoteInput } from "@/lib/schemas";
import { parseDay, type ShipmentMode } from "@/lib/shipment";
import { audit, nextNumber } from "./shared";
import { createShipment } from "./shipments";

type Ctx = { tenantId: string; actorId: string | null };
const blank = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);

function quoteData(input: QuoteInput) {
  const t = computeTotals(input.lines, input.taxBp);
  return {
    customerName: input.customerName,
    customerCompany: blank(input.customerCompany),
    customerEmail: blank(input.customerEmail)?.toLowerCase() ?? null,
    customerAddress: blank(input.customerAddress),
    mode: input.mode,
    origin: input.origin,
    destination: input.destination,
    validUntil: parseDay(input.validUntil),
    currency: input.currency,
    taxBp: input.taxBp,
    lines: t.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })) satisfies Prisma.InputJsonValue,
    subtotal: t.subtotal,
    taxTotal: t.tax,
    total: t.total,
    notes: blank(input.notes),
  };
}

export async function createQuote(tx: Tx, ctx: Ctx, input: QuoteInput) {
  const quoteNo = await nextNumber(tx, ctx.tenantId, "quote");
  const row = await tx.quote.create({ data: { tenantId: ctx.tenantId, quoteNo, inquiryId: input.inquiryId ?? null, ...quoteData(input) } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "quote.create", entity: "quote", entityId: row.id, after: { quoteNo, total: row.total } });
  // Quoting an inquiry that is still new moves it along, so the inbox shows what has been dealt with.
  if (input.inquiryId) {
    const moved = await tx.inquiry.updateMany({ where: { id: input.inquiryId, status: "NEW" }, data: { status: "QUOTED", updatedAt: new Date() } });
    if (moved.count) await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "inquiry.status", entity: "inquiry", entityId: input.inquiryId, before: { status: "NEW" }, after: { status: "QUOTED" } });
  }
  return row;
}

/** Accepted quotes are a record of what the customer agreed to, so they can't be edited; reopen to draft first. */
export async function updateQuote(tx: Tx, ctx: Ctx, id: string, input: QuoteInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const before = await tx.quote.findUnique({ where: { id }, select: { status: true } });
  if (!before) return { ok: false, error: "That quote no longer exists." };
  if (before.status === "ACCEPTED") return { ok: false, error: "An accepted quote can't be changed. Reopen it as a draft first." };
  await tx.quote.update({ where: { id }, data: { ...quoteData(input), updatedAt: new Date() } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "quote.update", entity: "quote", entityId: id });
  return { ok: true, id };
}

export async function listQuotes(tx: Tx, opts: { status?: string; limit?: number } = {}) {
  const status = QUOTE_STATUSES.includes(opts.status as QuoteStatus) ? opts.status : undefined;
  return tx.quote.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: opts.limit ?? 200 });
}

export async function quoteCounts(tx: Tx): Promise<Record<QuoteStatus, number>> {
  const rows = await tx.quote.groupBy({ by: ["status"], _count: { _all: true } });
  const out: Record<QuoteStatus, number> = { DRAFT: 0, SENT: 0, ACCEPTED: 0, REJECTED: 0 };
  for (const r of rows) if (r.status in out) out[r.status as QuoteStatus] = r._count._all;
  return out;
}

export async function setQuoteStatus(tx: Tx, ctx: Ctx, id: string, to: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await tx.quote.findUnique({ where: { id }, select: { status: true } });
  if (!row) return { ok: false, error: "That quote no longer exists." };
  if (!canMoveQuote(row.status, to)) return { ok: false, error: `A ${QUOTE_STATUS_LABELS[row.status as QuoteStatus]?.toLowerCase() ?? row.status} quote can't be marked ${QUOTE_STATUS_LABELS[to as QuoteStatus]?.toLowerCase() ?? to}.` };
  await tx.quote.update({ where: { id }, data: { status: to, updatedAt: new Date() } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "quote.status", entity: "quote", entityId: id, before: { status: row.status }, after: { status: to } });
  return { ok: true };
}

/**
 * Turns a quote into a shipment: route, mode and customer are carried over, and the quote is marked accepted. Asked twice it
 * returns the shipment already made. The consignee and packages are left for staff to fill in on the edit screen.
 */
export async function createShipmentFromQuote(tx: Tx, ctx: Ctx, quoteId: string): Promise<{ id: string; created: boolean } | null> {
  const q = await tx.quote.findUnique({ where: { id: quoteId } });
  if (!q) return null;
  if (q.shipmentId) {
    const existing = await tx.shipment.findUnique({ where: { id: q.shipmentId }, select: { id: true } });
    if (existing) return { id: existing.id, created: false };
  }
  const row = await createShipment(
    tx,
    ctx,
    {
      mode: q.mode as ShipmentMode,
      customerRef: "",
      shipper: { name: q.customerCompany || q.customerName, address: q.customerAddress ?? "", phone: "", email: q.customerEmail ?? "", taxId: "" },
      consignee: { name: "", address: "", phone: "", email: "", taxId: "" },
      notifyParty: null,
      origin: q.origin,
      destination: q.destination,
      incoterm: "", carrier: "", vesselOrFlight: "", voyageNo: "", masterNo: "", houseNo: "", containerNo: "", sealNo: "",
      etd: "", eta: "",
      goods: "To be confirmed",
      marks: "",
      currency: q.currency,
      notes: `From quote ${q.quoteNo}.`,
      packages: [{ quantity: 1, packageType: "Other", description: "To be confirmed", lengthCm: null, widthCm: null, heightCm: null, grossWeightKg: null, marks: "", hsCode: "", declaredValue: null }],
    },
    { quoteId, inquiryId: q.inquiryId ?? undefined },
  );
  await tx.quote.update({ where: { id: quoteId }, data: { shipmentId: row.id, status: "ACCEPTED", updatedAt: new Date() } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "quote.status", entity: "quote", entityId: quoteId, before: { status: q.status }, after: { status: "ACCEPTED" } });
  return { id: row.id, created: true };
}
