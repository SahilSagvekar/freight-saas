/** Line items, totals and statuses for freight quotes and invoices. Money is whole minor units; tax is in basis points (1200 = 12%). */

export type BillLine = { description: string; quantity: number; unitPrice: number };
export type PricedLine = BillLine & { amount: number };
export type Totals = { lines: PricedLine[]; subtotal: number; tax: number; total: number };

/** Postgres INTEGER holds just over 2.1 billion; stay clear of it. */
export const MAX_MINOR = 2_000_000_000;

export class BillingMathError extends Error {}

/** Each line is quantity × unit price rounded to a whole minor unit; tax is on the subtotal, rounded once. */
export function computeTotals(lines: readonly BillLine[], taxBp: number): Totals {
  const priced = lines.map((l) => {
    const amount = Math.round(l.quantity * l.unitPrice);
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MINOR) throw new BillingMathError(`"${l.description}" comes to too large an amount.`);
    return { ...l, amount };
  });
  const subtotal = priced.reduce((n, l) => n + l.amount, 0);
  const tax = Math.round((subtotal * taxBp) / 10_000);
  const total = subtotal + tax;
  if (total > MAX_MINOR) throw new BillingMathError("The total is too large.");
  return { lines: priced, subtotal, tax, total };
}

/** "12" or "12.5" percent → basis points, or null when it isn't a sensible percentage. */
export function percentToBp(text: string): number | null {
  const t = text.trim().replace(/%$/, "").trim();
  if (t === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp <= 10_000 ? bp : null;
}

export const bpToPercent = (bp: number) => String(bp / 100);

/** Adds days to a "YYYY-MM-DD" day, in UTC so daylight saving can't shift it. */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = { DRAFT: "Draft", SENT: "Sent", ACCEPTED: "Accepted", REJECTED: "Rejected" };
/** A quote can be reopened to draft from anywhere, so a mistaken click is never permanent. */
const QUOTE_NEXT: Record<QuoteStatus, readonly QuoteStatus[]> = { DRAFT: ["SENT", "ACCEPTED", "REJECTED"], SENT: ["ACCEPTED", "REJECTED", "DRAFT"], ACCEPTED: ["DRAFT"], REJECTED: ["DRAFT"] };
export const nextQuoteStatuses = (from: string): readonly QuoteStatus[] => QUOTE_NEXT[from as QuoteStatus] ?? [];
export const canMoveQuote = (from: string, to: string) => nextQuoteStatuses(from).includes(to as QuoteStatus);

export const INVOICE_STATUSES = ["UNPAID", "PAID", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { UNPAID: "Unpaid", PAID: "Paid", VOID: "Void" };
const INVOICE_NEXT: Record<InvoiceStatus, readonly InvoiceStatus[]> = { UNPAID: ["PAID", "VOID"], PAID: ["UNPAID"], VOID: [] };
export const nextInvoiceStatuses = (from: string): readonly InvoiceStatus[] => INVOICE_NEXT[from as InvoiceStatus] ?? [];
export const canMoveInvoice = (from: string, to: string) => nextInvoiceStatuses(from).includes(to as InvoiceStatus);

/** An unpaid invoice is overdue once its due day has passed (the due day itself is still fine). */
export const isOverdue = (status: string, dueOn: string, today: string) => status === "UNPAID" && dueOn < today;

/** Reads the JSON stored on a document back into lines, ignoring anything malformed. */
export function linesOf(json: unknown): BillLine[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((x) => {
    const o = x as Partial<BillLine> | null;
    return o && typeof o.description === "string" && typeof o.quantity === "number" && typeof o.unitPrice === "number" ? [{ description: o.description, quantity: o.quantity, unitPrice: o.unitPrice }] : [];
  });
}
