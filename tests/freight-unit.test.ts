import { describe, expect, it } from "vitest";
import { shipmentSchema } from "@/lib/schemas";
import { airChargeableKg, canMoveShipment, lineVolumeCbm, nextShipmentStatuses, packageTotals, parseDay } from "@/lib/shipment";
import { emptyShipmentForm, formFromShipment, parseNumber, toShipmentPayload } from "@/lib/shipment-form";

const filled = () => {
  const f = emptyShipmentForm();
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
    const back = formFromShipment({ ...p, customerRef: null, incoterm: null, carrier: null, vesselOrFlight: null, voyageNo: null, masterNo: null, houseNo: null, containerNo: null, sealNo: null, etd: null, eta: null, marks: null, notes: null, notifyParty: null, packages: p.packages.map((x) => ({ ...x, marks: null, hsCode: null })) });
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
