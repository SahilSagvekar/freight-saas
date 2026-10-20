import { describe, expect, it } from "vitest";
import { shipmentSchema } from "@/lib/schemas";
import { airChargeableKg, canMoveShipment, lineVolumeCbm, nextShipmentStatuses, packageTotals, parseDay } from "@/lib/shipment";
import { emptyShipmentForm, formFromShipment, parseNumber, toShipmentPayload } from "@/lib/shipment-form";

const filled = () => {
  const f = emptyShipmentForm();
  f.mode = "OCEAN";
  f.origin = "Shanghai";
  f.destination = "Rotterdam";
  f.goods = "Ceramic tiles";
  f.shipper = { name: "Acme Ltd", address: "1 Road", phone: "", email: "", taxId: "" };
  f.consignee = { name: "Bolt BV", address: "2 Straat", phone: "", email: "", taxId: "" };
  f.packages = [{ ...f.packages[0]!, description: "Tiles", quantity: "10", weight: "1,200.5", value: "99.90" }];
  return f;
};

describe("shipment status flow", () => {
  it("only allows the forward steps", () => {
    expect(canMoveShipment("BOOKED", "IN_TRANSIT")).toBe(true);
    expect(canMoveShipment("BOOKED", "DELIVERED")).toBe(false);
    expect(nextShipmentStatuses("DELIVERED")).toEqual([]);
    expect(canMoveShipment("CANCELLED", "BOOKED")).toBe(true);
    expect(nextShipmentStatuses("nonsense")).toEqual([]);
  });
});

describe("package totals", () => {
  it("sums pieces, weight and volume", () => {
    const line = { quantity: 2, packageType: "Pallet", description: "x", lengthCm: 100, widthCm: 100, heightCm: 100, grossWeightKg: 50, marks: null, hsCode: null, declaredValue: 1000 };
    expect(lineVolumeCbm(line)).toBe(2);
    const t = packageTotals([line, { ...line, grossWeightKg: null, lengthCm: null }]);
    expect(t.pieces).toBe(4);
    expect(t.grossKg).toBe(50);
    expect(t.cbm).toBe(2);
    expect(t.declaredValue).toBe(2000);
    expect(t.linesWithoutWeight).toBe(1);
  });
  it("charges air freight on the larger of weight and volume", () => {
    expect(airChargeableKg({ grossKg: 100, cbm: 1 })).toBe(167);
    expect(airChargeableKg({ grossKg: 500, cbm: 1 })).toBe(500);
  });
});

describe("dates and numbers", () => {
  it("reads real days only", () => {
    expect(parseDay("2026-03-04")?.toISOString().slice(0, 10)).toBe("2026-03-04");
    expect(parseDay("")).toBeNull();
    expect(parseDay("2026-02-31")).toBeNull();
  });
  it("tells blank from invalid", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("1,200.5")).toBe(1200.5);
    expect(parseNumber("12kg")).toBeNaN();
  });
});

describe("shipment form", () => {
  it("converts to a payload the server schema accepts", () => {
    const { payload, errors } = toShipmentPayload(filled(), "USD");
    expect(errors).toEqual({});
    const parsed = shipmentSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.packages[0]!.declaredValue).toBe(9990);
      expect(parsed.data.packages[0]!.grossWeightKg).toBe(1200.5);
      expect(parsed.data.notifyParty).toBeNull();
    }
  });
  it("rejects a missing consignee and a bad value", () => {
    const f = filled();
    f.consignee.name = "";
    f.packages[0]!.value = "abc";
    const { payload, errors } = toShipmentPayload(f, "USD");
    expect(errors["packages.0.declaredValue"]).toBeTruthy();
    expect(shipmentSchema.safeParse(payload).success).toBe(false);
  });
  it("round-trips a saved shipment", () => {
    const f = filled();
    const { payload } = toShipmentPayload(f, "USD");
    const p = shipmentSchema.parse(payload);
    const back = formFromShipment({ ...p, customerRef: null, incoterm: null, carrier: null, vesselOrFlight: null, voyageNo: null, masterNo: null, houseNo: null, containerNo: null, sealNo: null, etd: null, eta: null, marks: null, notes: null, notifyParty: null, packages: p.packages.map((x) => ({ ...x, lengthCm: x.lengthCm ?? null, widthCm: x.widthCm ?? null, heightCm: x.heightCm ?? null, grossWeightKg: x.grossWeightKg ?? null, declaredValue: x.declaredValue ?? null, marks: null, hsCode: null })) });
    expect(back.packages[0]!.value).toBe("99.90");
    expect(back.origin).toBe("Shanghai");
  });
});

describe("shipment dates in the schema", () => {
  it("rejects a day that does not exist", () => {
    const { payload } = toShipmentPayload({ ...filled(), etd: "2026-02-31" }, "USD");
    expect(shipmentSchema.safeParse(payload).success).toBe(false);
  });
});

import { labelPieces } from "@/lib/shipment";
import { readTrackingCode, trackingCode } from "@/lib/tracking-code";

describe("labels", () => {
  const line = (quantity: number) => ({ quantity, packageType: "Carton", description: "x", lengthCm: null, widthCm: null, heightCm: null, grossWeightKg: null, marks: null, hsCode: null, declaredValue: null });
  it("numbers pieces across lines", () => {
    const { pieces, total } = labelPieces([line(2), line(3)]);
    expect(total).toBe(5);
    expect(pieces.map((p) => `${p.n}/${p.of}`)).toEqual(["1/5", "2/5", "3/5", "4/5", "5/5"]);
  });
  it("caps runaway quantities", () => {
    const r = labelPieces([line(100000)], 500);
    expect(r.pieces).toHaveLength(500);
    expect(r.truncated).toBe(true);
    expect(r.total).toBe(100000);
  });
});

describe("tracking codes", () => {
  const id = "0b5f5f0e-6a2e-4d1c-9f3a-2f1d9e7c1a11";
  it("round-trips and rejects tampering", () => {
    const code = trackingCode(id);
    expect(readTrackingCode(code)).toBe(id);
    expect(readTrackingCode(`https://x.test/track/${encodeURIComponent(code)}`)).toBe(id);
    expect(readTrackingCode(code.slice(0, -1) + (code.endsWith("a") ? "b" : "a"))).toBeNull();
    expect(readTrackingCode(code.replace(id, "0b5f5f0e-6a2e-4d1c-9f3a-2f1d9e7c1a12"))).toBeNull();
    expect(readTrackingCode("HL1." + code.split(".").slice(1).join("."))).toBeNull();
  });
});

import { parseCsv } from "@/lib/csv-parse";
import { inquiriesCsv, shipmentsCsv } from "@/lib/freight-csv";
import { importTemplateRows, readShipmentCsv } from "@/lib/shipment-import";
import { toCsv } from "@/lib/csv";

describe("csv parsing", () => {
  it("reads quotes, commas, line breaks, BOM and CRLF", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n\r\n');
    expect(rows).toEqual([["a", "b", "c"], ["x, y", 'say "hi"', "line1\nline2"]]);
  });
  it("detects semicolons", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("round-trips what we write", () => {
    const rows = [["a", "b"], ["x,y", 'q"r']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("shipment import", () => {
  it("accepts the template's own example row", () => {
    const r = readShipmentCsv(toCsv(importTemplateRows()), "USD");
    expect(r.errors).toEqual([]);
    expect(r.shipments).toHaveLength(1);
    expect(r.shipments[0]!.packages[0]!.declaredValue).toBe(1580000);
    expect(r.shipments[0]!.mode).toBe("OCEAN");
  });
  it("reports row numbers for bad rows and missing columns", () => {
    const head = importTemplateRows()[0]!;
    const good = importTemplateRows()[1]!;
    const bad = [...good];
    bad[head.indexOf("weight_kg")] = "heavy";
    const bad2 = [...good];
    bad2[head.indexOf("consignee_name")] = "";
    const r = readShipmentCsv(toCsv([head, good, bad, bad2]), "USD");
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatch(/^Row 3:.*weight_kg/);
    expect(r.errors[1]).toMatch(/^Row 4:/);
    expect(readShipmentCsv("origin,destination\nA,B", "USD").errors[0]).toMatch(/Missing columns/);
    expect(readShipmentCsv("", "USD").errors).toHaveLength(1);
  });
  it("rejects a row with no mode instead of assuming ocean", () => {
    const head = importTemplateRows()[0]!;
    const row = [...importTemplateRows()[1]!];
    row[head.indexOf("mode")] = "";
    const r = readShipmentCsv(toCsv([head, row]), "USD");
    expect(r.shipments).toEqual([]);
    expect(r.errors[0]).toMatch(/^Row 2: Choose air, ocean or road/);
  });
  it("starts a new shipment form with no mode chosen", () => {
    expect(emptyShipmentForm().mode).toBe("");
    expect(toShipmentPayload({ ...filled(), mode: "" }, "USD").errors.mode).toBeTruthy();
  });
  it("understands mode words", () => {
    const head = importTemplateRows()[0]!;
    const row = [...importTemplateRows()[1]!];
    row[head.indexOf("mode")] = "Road";
    expect(readShipmentCsv(toCsv([head, row]), "USD").shipments[0]!.mode).toBe("GROUND");
  });
});

describe("freight exports", () => {
  it("neutralises spreadsheet formulas from customer text", () => {
    const csv = inquiriesCsv([{ inquiryNo: 1, status: "NEW", name: "=HYPERLINK(1)", company: null, email: "a@b.co", phone: null, mode: "AIR", origin: "A", destination: "B", cargo: "c", weightKg: 5, readyOn: null, message: null, createdAt: new Date("2026-01-01") }], (n) => `INQ-${n}`);
    expect(csv).toContain("'=HYPERLINK(1)");
  });
  it("totals pieces and weight per shipment", () => {
    const csv = shipmentsCsv([{ shipmentNo: 7, status: "BOOKED", mode: "OCEAN", customerRef: null, shipper: { name: "S" }, consignee: { name: "C" }, origin: "A", destination: "B", incoterm: null, carrier: null, masterNo: null, houseNo: null, containerNo: null, etd: null, eta: null, goods: "g", currency: "USD", createdAt: new Date("2026-01-01"), packages: [{ quantity: 2, lengthCm: null, widthCm: null, heightCm: null, grossWeightKg: 10, declaredValue: 500 }, { quantity: 3, lengthCm: null, widthCm: null, heightCm: null, grossWeightKg: 5, declaredValue: null }] }], (n) => `SH-${n}`);
    expect(csv).toContain("SH-7,Booked,Ocean");
    expect(csv).toContain(",5,15,0,5.00,USD,");
  });
});

import { addDays, canMoveInvoice, canMoveQuote, computeTotals, isOverdue, linesOf, percentToBp } from "@/lib/freight-billing";
import { freightInvoiceSchema, quoteSchema } from "@/lib/schemas";

describe("quote and invoice maths", () => {
  it("rounds each line, then tax once on the subtotal", () => {
    const t = computeTotals([{ description: "a", quantity: 3, unitPrice: 333 }, { description: "b", quantity: 1.5, unitPrice: 101 }], 1200);
    expect(t.lines.map((l) => l.amount)).toEqual([999, 152]);
    expect(t.subtotal).toBe(1151);
    expect(t.tax).toBe(138);
    expect(t.total).toBe(1289);
  });
  it("refuses amounts that would overflow the database", () => {
    expect(() => computeTotals([{ description: "huge", quantity: 1_000_000, unitPrice: 2_000_000_000 }], 0)).toThrow();
    expect(() => computeTotals([{ description: "a", quantity: 1, unitPrice: 2_000_000_000 }, { description: "b", quantity: 1, unitPrice: 1 }], 0)).toThrow();
  });
  it("reads percentages", () => {
    expect(percentToBp("12")).toBe(1200);
    expect(percentToBp("7.5%")).toBe(750);
    expect(percentToBp("")).toBe(0);
    expect(percentToBp("abc")).toBeNull();
    expect(percentToBp("150")).toBeNull();
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-01-31", 14)).toBe("2026-02-14");
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08");
  });
  it("flags overdue only for unpaid invoices past their due day", () => {
    expect(isOverdue("UNPAID", "2026-05-01", "2026-05-02")).toBe(true);
    expect(isOverdue("UNPAID", "2026-05-02", "2026-05-02")).toBe(false);
    expect(isOverdue("PAID", "2026-05-01", "2026-05-02")).toBe(false);
  });
  it("moves statuses sensibly", () => {
    expect(canMoveQuote("SENT", "ACCEPTED")).toBe(true);
    expect(canMoveQuote("ACCEPTED", "REJECTED")).toBe(false);
    expect(canMoveInvoice("VOID", "UNPAID")).toBe(false);
    expect(canMoveInvoice("PAID", "UNPAID")).toBe(true);
  });
  it("drops malformed stored lines", () => {
    expect(linesOf([{ description: "x", quantity: 1, unitPrice: 5 }, { description: 3 }, null])).toHaveLength(1);
    expect(linesOf("nope")).toEqual([]);
  });
  const base = { customerName: "Bolt", currency: "usd", taxBp: 0, lines: [{ description: "Freight", quantity: 1, unitPrice: 1000 }] };
  it("validates quotes and invoices", () => {
    expect(quoteSchema.safeParse({ ...base, mode: "AIR", origin: "A", destination: "B" }).success).toBe(true);
    expect(quoteSchema.safeParse({ ...base, lines: [], mode: "AIR", origin: "A", destination: "B" }).success).toBe(false);
    expect(freightInvoiceSchema.safeParse({ ...base, issuedOn: "2026-05-10", dueOn: "2026-05-01" }).success).toBe(false);
    expect(freightInvoiceSchema.safeParse({ ...base, issuedOn: "2026-05-01", dueOn: "2026-05-15" }).success).toBe(true);
  });
});

import { billFormFrom, emptyBillForm, previewTotals, toInvoicePayload, toQuotePayload } from "@/lib/billing-form";

describe("billing form", () => {
  const filledBill = () => ({ ...emptyBillForm({ customerName: "Bolt", mode: "AIR", origin: "A", destination: "B", issuedOn: "2026-05-01", dueOn: "2026-05-15", taxPercent: "10" }), lines: [{ key: 1, description: "Ocean freight", quantity: "2", unitPrice: "1,200.50" }] });
  it("converts to payloads the schemas accept", () => {
    const f = filledBill();
    const q = toQuotePayload(f, "USD", null);
    expect(q.errors).toEqual({});
    expect(quoteSchema.safeParse(q.payload).success).toBe(true);
    const i = toInvoicePayload(f, "USD", { shipmentId: null, quoteId: null });
    expect(freightInvoiceSchema.safeParse(i.payload).success).toBe(true);
    expect(i.payload.lines[0]!.unitPrice).toBe(120050);
    expect(i.payload.taxBp).toBe(1000);
  });
  it("won't make a quote until a mode is chosen", () => {
    expect(toQuotePayload({ ...filledBill(), mode: "" }, "USD", null).errors.mode).toMatch(/air, ocean or road/);
  });
  it("previews totals and goes quiet on unreadable input", () => {
    expect(previewTotals(filledBill(), "USD")?.total).toBe(264110);
    const f = filledBill();
    f.lines[0]!.unitPrice = "abc";
    expect(previewTotals(f, "USD")).toBeNull();
    expect(toQuotePayload(f, "USD", null).errors["lines.0.unitPrice"]).toBeTruthy();
  });
  it("round-trips a stored document", () => {
    const f = billFormFrom({ customerName: "Bolt", customerCompany: null, customerEmail: null, customerAddress: null, notes: null, taxBp: 750, currency: "USD", lines: [{ description: "x", quantity: 2, unitPrice: 1050 }] });
    expect(f.taxPercent).toBe("7.5");
    expect(f.lines[0]!.unitPrice).toBe("10.50");
  });
});
