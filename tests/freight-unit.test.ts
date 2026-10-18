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
