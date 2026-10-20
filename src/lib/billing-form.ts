import { computeTotals, bpToPercent, linesOf, percentToBp, type BillLine, type Totals } from "./freight-billing";
import { fromMinor, toMinor } from "./money";
import { isShipmentMode } from "./shipment";
import { parseNumber } from "./shipment-form";

/** Quote and invoice forms share one shape. The fields a kind doesn't use are simply ignored. */
export type BillLineForm = { key: number; description: string; quantity: string; unitPrice: string };
export type BillForm = {
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerAddress: string;
  notes: string;
  taxPercent: string;
  lines: BillLineForm[];
  // quote
  mode: string;
  origin: string;
  destination: string;
  validUntil: string;
  // invoice
  reference: string;
  issuedOn: string;
  dueOn: string;
};

export const emptyBillLine = (key: number): BillLineForm => ({ key, description: "", quantity: "1", unitPrice: "" });

export const emptyBillForm = (d: Partial<BillForm> = {}): BillForm => ({
  customerName: "", customerCompany: "", customerEmail: "", customerAddress: "", notes: "", taxPercent: "0",
  lines: [emptyBillLine(1)],
  mode: "", origin: "", destination: "", validUntil: "",
  reference: "", issuedOn: "", dueOn: "",
  ...d,
});

type Converted = { lines: BillLine[]; taxBp: number; errors: Record<string, string> };

function convertLines(form: BillForm, currency: string): Converted {
  const errors: Record<string, string> = {};
  const taxBp = percentToBp(form.taxPercent);
  if (taxBp === null) errors.taxBp = "Enter a tax rate like 12 or 7.5";
  const lines = form.lines.map((l, i) => {
    const quantity = parseNumber(l.quantity);
    const price = l.unitPrice.trim() === "" ? null : toMinor(l.unitPrice, currency);
    if (price === null) errors[`lines.${i}.unitPrice`] = "Enter a price like 120.50";
    if (quantity === null || Number.isNaN(quantity)) errors[`lines.${i}.quantity`] = "Enter a quantity";
    return { description: l.description, quantity: quantity ?? Number.NaN, unitPrice: price ?? Number.NaN };
  });
  return { lines, taxBp: taxBp ?? 0, errors };
}

const customerOf = (f: BillForm) => ({ customerName: f.customerName, customerCompany: f.customerCompany, customerEmail: f.customerEmail, customerAddress: f.customerAddress });

export function toQuotePayload(form: BillForm, currency: string, inquiryId: string | null) {
  const c = convertLines(form, currency);
  if (!isShipmentMode(form.mode)) c.errors.mode = "Choose air, ocean or road";
  return { errors: c.errors, payload: { ...customerOf(form), mode: form.mode, origin: form.origin, destination: form.destination, validUntil: form.validUntil, currency, taxBp: c.taxBp, lines: c.lines, notes: form.notes, inquiryId } };
}

export function toInvoicePayload(form: BillForm, currency: string, links: { shipmentId: string | null; quoteId: string | null }) {
  const c = convertLines(form, currency);
  return { errors: c.errors, payload: { ...customerOf(form), reference: form.reference, issuedOn: form.issuedOn, dueOn: form.dueOn, currency, taxBp: c.taxBp, lines: c.lines, notes: form.notes, ...links } };
}

/** The running total shown under the lines. Null while a price or quantity can't be read yet. */
export function previewTotals(form: BillForm, currency: string): Totals | null {
  const c = convertLines(form, currency);
  if (Object.keys(c.errors).length) return null;
  try {
    return computeTotals(c.lines, c.taxBp);
  } catch {
    return null;
  }
}

type Stored = { customerName: string; customerCompany: string | null; customerEmail: string | null; customerAddress: string | null; notes: string | null; taxBp: number; lines: unknown; currency: string };

export function billFormFrom(row: Stored, extra: Partial<BillForm> = {}): BillForm {
  const lines = linesOf(row.lines);
  return emptyBillForm({
    customerName: row.customerName,
    customerCompany: row.customerCompany ?? "",
    customerEmail: row.customerEmail ?? "",
    customerAddress: row.customerAddress ?? "",
    notes: row.notes ?? "",
    taxPercent: bpToPercent(row.taxBp),
    lines: lines.length ? lines.map((l, i) => ({ key: i + 1, description: l.description, quantity: String(l.quantity), unitPrice: fromMinor(l.unitPrice, row.currency) })) : [emptyBillLine(1)],
    ...extra,
  });
}
