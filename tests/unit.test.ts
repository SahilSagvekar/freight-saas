import { describe, expect, it } from "vitest";
import { describeAttributes, validateAttributes } from "@/lib/attributes";
import { checkCapacity, oversellAllowance } from "@/lib/capacity";
import { isPerUnit, type FieldDef } from "@/lib/domain";
import { formatMoney, fromMinor, minorUnitDigits, toMinor } from "@/lib/money";
import { parseEmails } from "@/lib/email-list";
import { computeLine, resolveUnitPrice, sumLines } from "@/lib/pricing";
import { inquirySchema } from "@/lib/schemas";

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

describe("one row per person or vehicle", () => {
  const fields: FieldDef[] = [{ key: "plate", label: "Plate", type: "text" }];
  it("needs its own row for passengers and vehicles that record details", () => {
    expect(isPerUnit("PASSENGER", fields)).toBe(true);
    expect(isPerUnit("VEHICLE", fields)).toBe(true);
  });
  it("lets cargo, and types with no details, be counted", () => {
    expect(isPerUnit("CARGO", fields)).toBe(false);
    expect(isPerUnit("PASSENGER", [])).toBe(false);
  });
});

describe("website inquiry form", () => {
  const valid = { name: "Priya Shah", email: "priya@acme.test", mode: "OCEAN", origin: "Mumbai", destination: "Dubai", cargo: "12 pallets of tiles" };

  it("accepts the minimum a forwarder needs for a quote", () => {
    const r = inquirySchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("treats blank optional fields as missing", () => {
    const r = inquirySchema.safeParse({ ...valid, phone: "", company: "", weightKg: "", readyOn: "", message: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.weightKg).toBeUndefined();
      expect(r.data.readyOn).toBeUndefined();
    }
  });

  it("reads weight and date from form strings", () => {
    const r = inquirySchema.safeParse({ ...valid, weightKg: "1250.5", readyOn: "2026-12-31" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.weightKg).toBe(1250.5);
  });

  it("rejects missing or bad fields with a plain message", () => {
    const msg = (o: object) => {
      const r = inquirySchema.safeParse({ ...valid, ...o });
      return r.success ? null : r.error.issues[0]?.message;
    };
    expect(msg({ name: "  " })).toBe("Enter your name");
    expect(msg({ email: "nope" })).toBe("Enter a valid email");
    expect(msg({ mode: "TRAIN" })).toBe("Choose how you want to ship");
    expect(msg({ cargo: "" })).toBe("Tell us what you are shipping");
    expect(msg({ weightKg: "-3" })).toBe("Weight must be more than 0");
    expect(msg({ readyOn: "31/12/2026" })).toBe("Use a date like 2026-12-31");
  });
});

describe("notification addresses", () => {
  it("keeps valid, distinct addresses from a pasted list", () => {
    expect(parseEmails("Sales@Acme.test, ops@acme.test; sales@acme.test  not-an-email")).toEqual(["sales@acme.test", "ops@acme.test"]);
    expect(parseEmails("")).toEqual([]);
  });
});
