import { describe, expect, it } from "vitest";
import { describeAttributes, validateAttributes } from "@/lib/attributes";
import { checkCapacity, oversellAllowance } from "@/lib/capacity";
import type { FieldDef } from "@/lib/domain";
import { formatMoney, fromMinor, minorUnitDigits, toMinor } from "@/lib/money";
import { computeLine, resolveUnitPrice, sumLines } from "@/lib/pricing";

describe("money", () => {
  it("knows currency decimal places", () => {
    expect(minorUnitDigits("USD")).toBe(2);
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(minorUnitDigits("BHD")).toBe(3);
  });

  it("converts between display and minor units", () => {
    expect(toMinor("12.50", "USD")).toBe(1250);
    expect(toMinor("1,200", "USD")).toBe(120000);
    expect(toMinor("500", "JPY")).toBe(500);
    expect(toMinor("abc", "USD")).toBeNull();
    expect(toMinor("-3", "USD")).toBeNull();
    expect(fromMinor(1250, "USD")).toBe("12.50");
  });

  it("formats with currency and locale", () => {
    expect(formatMoney(123456, "USD", "en")).toBe("$1,234.56");
  });
});

describe("resolveUnitPrice", () => {
  const rule = (o: string | null, d: string | null, price: number, active = true) => ({
    itemTypeId: "adult",
    originId: o,
    destinationId: d,
    unitPrice: price,
    active,
  });
  const q = { itemTypeId: "adult", originId: "A", destinationId: "B" };

  it("prefers the exact route over a generic rule", () => {
    expect(resolveUnitPrice([rule(null, null, 100), rule("A", "B", 150)], q)).toBe(150);
  });

  it("falls back to the generic rule and ignores other routes", () => {
    expect(resolveUnitPrice([rule("A", "C", 999), rule(null, null, 100)], q)).toBe(100);
  });

  it("ignores inactive rules and other item types, and returns null when nothing matches", () => {
    expect(resolveUnitPrice([rule(null, null, 100, false)], q)).toBeNull();
    expect(resolveUnitPrice([{ ...rule(null, null, 100), itemTypeId: "child" }], q)).toBeNull();
  });

  it("takes the first of two equally specific rules (callers pass newest first)", () => {
    expect(resolveUnitPrice([rule("A", "B", 200), rule("A", "B", 150)], q)).toBe(200);
  });
});

describe("computeLine", () => {
  const vat = (inclusive: boolean, bp = 1200, appliesTo: "ALL" | "CARGO" = "ALL") => ({
    name: "VAT",
    rateBp: bp,
    appliesTo,
    inclusive,
    active: true,
  });

  it("returns the plain price with no tax rules", () => {
    expect(computeLine({ unitPrice: 2500, quantity: 3, kind: "PASSENGER", taxRules: [] })).toEqual({
      subtotal: 7500,
      taxAmount: 0,
      total: 7500,
    });
  });

  it("adds exclusive tax on top", () => {
    expect(computeLine({ unitPrice: 10000, quantity: 1, kind: "CARGO", taxRules: [vat(false)] })).toEqual({
      subtotal: 10000,
      taxAmount: 1200,
      total: 11200,
    });
  });

  it("carves inclusive tax out of the listed price", () => {
    const line = computeLine({ unitPrice: 11200, quantity: 1, kind: "CARGO", taxRules: [vat(true)] });
    expect(line).toEqual({ subtotal: 10000, taxAmount: 1200, total: 11200 });
  });

  it("only applies rules that match the item kind and are active", () => {
    const rules = [vat(false, 1200, "CARGO"), { ...vat(false, 500), active: false }];
    expect(computeLine({ unitPrice: 1000, quantity: 1, kind: "PASSENGER", taxRules: rules }).taxAmount).toBe(0);
    expect(computeLine({ unitPrice: 1000, quantity: 1, kind: "CARGO", taxRules: rules }).taxAmount).toBe(120);
  });

  it("rounds half up in whole minor units and never loses a cent between subtotal, tax and total", () => {
    const line = computeLine({ unitPrice: 333, quantity: 1, kind: "CARGO", taxRules: [vat(false, 1250)] });
    expect(line.taxAmount).toBe(42); // 41.625 rounds up
    expect(line.subtotal + line.taxAmount).toBe(line.total);
  });

  it("sums lines", () => {
    const total = sumLines([
      { subtotal: 100, taxAmount: 12, total: 112 },
      { subtotal: 50, taxAmount: 6, total: 56 },
    ]);
    expect(total).toEqual({ subtotal: 150, taxAmount: 18, total: 168 });
  });
});

describe("validateAttributes", () => {
  const fields: FieldDef[] = [
    { key: "containerNo", label: "Container number", type: "text", required: true },
    { key: "size", label: "Size", type: "select", options: ["20 ft", "40 ft"], required: true },
    { key: "weightKg", label: "Weight (kg)", type: "number" },
    { key: "fragile", label: "Fragile", type: "boolean" },
  ];

  it("accepts valid input and coerces form strings", () => {
    const result = validateAttributes(fields, {
      containerNo: " MSKU123 ",
      size: "40 ft",
      weightKg: "1200",
      fragile: "on",
      junk: "dropped",
    });
    expect(result).toEqual({
      ok: true,
      value: { containerNo: "MSKU123", size: "40 ft", weightKg: 1200, fragile: true },
    });
  });

  it("reports every problem by field", () => {
    const result = validateAttributes(fields, { size: "60 ft", weightKg: "heavy" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["containerNo", "size", "weightKg"]);
    }
  });

  it("describes attributes for display", () => {
    expect(describeAttributes(fields, { containerNo: "MSKU123", size: "40 ft", fragile: true })).toBe(
      "Container number: MSKU123 · Size: 40 ft · Fragile",
    );
  });
});

describe("capacity", () => {
  it("computes the oversell allowance", () => {
    expect(oversellAllowance(100, 5)).toBe(5);
    expect(oversellAllowance(18, 5)).toBe(1);
    expect(oversellAllowance(0, 5)).toBe(0);
    expect(oversellAllowance(100, 0)).toBe(0);
  });

  it("returns OK, OVERSELL or FULL", () => {
    expect(checkCapacity({ capacity: 10, used: 8, requested: 2, allowance: 1 }).verdict).toBe("OK");
    expect(checkCapacity({ capacity: 10, used: 8, requested: 3, allowance: 1 }).verdict).toBe("OVERSELL");
    expect(checkCapacity({ capacity: 10, used: 8, requested: 4, allowance: 1 }).verdict).toBe("FULL");
  });
});
