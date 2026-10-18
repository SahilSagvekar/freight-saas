import type { Tx } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import { canMoveInvoice, computeTotals, INVOICE_STATUS_LABELS, INVOICE_STATUSES, type InvoiceStatus } from "@/lib/freight-billing";
import type { FreightInvoiceInput } from "@/lib/schemas";
import { parseDay } from "@/lib/shipment";
import { audit, nextNumber } from "./shared";

type Ctx = { tenantId: string; actorId: string | null };
const blank = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);

function invoiceData(input: FreightInvoiceInput) {
  const t = computeTotals(input.lines, input.taxBp);
  return {
    customerName: input.customerName,
    customerCompany: blank(input.customerCompany),
    customerEmail: blank(input.customerEmail)?.toLowerCase() ?? null,
    customerAddress: blank(input.customerAddress),
    reference: blank(input.reference),
    issuedOn: parseDay(input.issuedOn)!,
    dueOn: parseDay(input.dueOn)!,
    currency: input.currency,
    taxBp: input.taxBp,
    lines: t.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })) satisfies Prisma.InputJsonValue,
    subtotal: t.subtotal,
    taxTotal: t.tax,
    total: t.total,
    notes: blank(input.notes),
  };
}

export async function createFreightInvoice(tx: Tx, ctx: Ctx, input: FreightInvoiceInput) {
  const invoiceNo = await nextNumber(tx, ctx.tenantId, "freight_invoice");
  const row = await tx.freightInvoice.create({ data: { tenantId: ctx.tenantId, invoiceNo, shipmentId: input.shipmentId ?? null, quoteId: input.quoteId ?? null, ...invoiceData(input) } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "freight_invoice.create", entity: "freight_invoice", entityId: row.id, after: { invoiceNo, total: row.total } });
  return row;
}

/** Only an unpaid invoice can change. Once paid or voided it is a record; reopen a paid one first. */
export async function updateFreightInvoice(tx: Tx, ctx: Ctx, id: string, input: FreightInvoiceInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const before = await tx.freightInvoice.findUnique({ where: { id }, select: { status: true } });
  if (!before) return { ok: false, error: "That invoice no longer exists." };
  if (before.status !== "UNPAID") return { ok: false, error: `A ${INVOICE_STATUS_LABELS[before.status as InvoiceStatus]?.toLowerCase() ?? before.status} invoice can't be changed.` };
  await tx.freightInvoice.update({ where: { id }, data: { ...invoiceData(input), updatedAt: new Date() } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "freight_invoice.update", entity: "freight_invoice", entityId: id });
  return { ok: true, id };
}

export async function listFreightInvoices(tx: Tx, opts: { status?: string; limit?: number } = {}) {
  const status = INVOICE_STATUSES.includes(opts.status as InvoiceStatus) ? opts.status : undefined;
  return tx.freightInvoice.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: opts.limit ?? 200 });
}

export async function freightInvoiceCounts(tx: Tx): Promise<Record<InvoiceStatus, number>> {
  const rows = await tx.freightInvoice.groupBy({ by: ["status"], _count: { _all: true } });
  const out: Record<InvoiceStatus, number> = { UNPAID: 0, PAID: 0, VOID: 0 };
  for (const r of rows) if (r.status in out) out[r.status as InvoiceStatus] = r._count._all;
  return out;
}

export async function setFreightInvoiceStatus(tx: Tx, ctx: Ctx, id: string, to: string, today: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await tx.freightInvoice.findUnique({ where: { id }, select: { status: true } });
  if (!row) return { ok: false, error: "That invoice no longer exists." };
  if (!canMoveInvoice(row.status, to)) return { ok: false, error: `A ${INVOICE_STATUS_LABELS[row.status as InvoiceStatus]?.toLowerCase() ?? row.status} invoice can't be marked ${INVOICE_STATUS_LABELS[to as InvoiceStatus]?.toLowerCase() ?? to}.` };
  await tx.freightInvoice.update({ where: { id }, data: { status: to, paidOn: to === "PAID" ? parseDay(today) : null, updatedAt: new Date() } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "freight_invoice.status", entity: "freight_invoice", entityId: id, before: { status: row.status }, after: { status: to } });
  return { ok: true };
}

/** Money still owed on unpaid invoices, and how much of it is past due. Amounts are in each invoice's own currency, so callers pass the workspace currency. */
export async function receivables(tx: Tx, currency: string, today: string) {
  const rows = await tx.freightInvoice.findMany({ where: { status: "UNPAID", currency }, select: { total: true, dueOn: true } });
  const dueDay = (d: Date) => d.toISOString().slice(0, 10);
  const overdue = rows.filter((r) => dueDay(r.dueOn) < today);
  return { count: rows.length, amount: rows.reduce((n, r) => n + r.total, 0), overdueCount: overdue.length, overdueAmount: overdue.reduce((n, r) => n + r.total, 0) };
}
