import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, DEFAULT_ROLES, type Permission } from "@/lib/domain";
import { homeFor, navFor, portalFor } from "@/lib/portals";
import { dayRange, localDateString, startOfDayInZone } from "@/lib/tz";
import { toCsv } from "@/lib/csv";
import { canMoveVoyage } from "@/lib/voyage-flow";

const role = (name: string) => DEFAULT_ROLES.find((r) => r.name === name)!.permissions;

describe("portals", () => {
  it("puts each default role in its own portal", () => {
    expect(portalFor(role("Owner"))).toBe("owner");
    expect(portalFor(role("Manager"))).toBe("manager");
    expect(portalFor(role("Booking agent"))).toBe("desk");
    expect(portalFor(role("Dock crew"))).toBe("dock");
    expect(portalFor(role("Cashier"))).toBe("cashier");
  });

  it("sends people to a home that exists for them", () => {
    expect(homeFor(role("Owner"))).toBe("/app");
    expect(homeFor(role("Booking agent"))).toBe("/app/desk");
    expect(homeFor(role("Dock crew"))).toBe("/app/voyages");
    expect(homeFor(role("Cashier"))).toBe("/app/bookings");
  });

  it("has no home, and no links, for a role with no permissions", () => {
    expect(portalFor([])).toBeNull();
    expect(homeFor([])).toBeNull();
    expect(navFor([])).toEqual([]);
  });

  it("only links to pages the person may open", () => {
    const hrefs = (p: Permission[]) => navFor(p).map((i) => i.href);
    expect(hrefs(role("Dock crew"))).toEqual(["/app/voyages", "/app/bookings", "/app/checkin"]);
    expect(hrefs(role("Booking agent"))).toContain("/app/desk");
    expect(hrefs(role("Booking agent"))).toContain("/app/inquiries");
    expect(hrefs(role("Dock crew"))).not.toContain("/app/inquiries");
    expect(hrefs(role("Booking agent"))).not.toContain("/app/review");
    expect(hrefs(role("Cashier"))).not.toContain("/app/settings");
    expect(hrefs(ALL_PERMISSIONS)).toEqual(["/app", "/app/desk", "/app/voyages", "/app/bookings", "/app/inquiries", "/app/checkin", "/app/reports", "/app/review", "/app/team", "/app/settings", "/app/billing"]);
  });

  it("gives freight workspaces freight links and homes, and no ferry pages", () => {
    const hrefs = (p: Permission[]) => navFor(p, "freight").map((i) => i.href);
    expect(hrefs(ALL_PERMISSIONS)).toEqual(["/app", "/app/inquiries", "/app/quotes", "/app/shipments", "/app/invoices", "/app/data", "/app/team", "/app/settings", "/app/billing"]);
    expect(hrefs(role("Booking agent"))).toEqual(["/app/inquiries", "/app/quotes", "/app/shipments"]);
    expect(hrefs(role("Dock crew"))).toEqual(["/app/shipments"]);
    expect(hrefs(role("Cashier"))).toEqual(["/app/shipments", "/app/invoices"]);
    expect(homeFor(role("Booking agent"), "freight")).toBe("/app/shipments");
    expect(homeFor(role("Dock crew"), "freight")).toBe("/app/shipments");
    expect(homeFor(role("Cashier"), "freight")).toBe("/app/invoices");
    expect(homeFor(role("Owner"), "freight")).toBe("/app");
    for (const r of ["Owner", "Manager", "Booking agent", "Dock crew", "Cashier"]) {
      expect(hrefs(role(r))).not.toContain("/app/desk");
      expect(hrefs(role(r))).not.toContain("/app/voyages");
    }
  });

  it("keeps ferry workspaces exactly as they were", () => {
    expect(homeFor(role("Booking agent"))).toBe("/app/desk");
    expect(homeFor(role("Booking agent"), "ferry")).toBe("/app/desk");
  });

  it("does not send a team-only role to a page that needs booking.view", () => {
    expect(homeFor(["team.manage"])).toBe("/app/team");
  });
});

describe("startOfDayInZone", () => {
  it("finds local midnight, not server midnight", () => {
    const now = new Date("2026-10-14T20:30:00Z");
    expect(startOfDayInZone(now, "UTC").toISOString()).toBe("2026-10-14T00:00:00.000Z");
    // Manila is UTC+8, so 20:30Z is already the 15th there.
    expect(startOfDayInZone(now, "Asia/Manila").toISOString()).toBe("2026-10-14T16:00:00.000Z");
    // Los Angeles is UTC-7 in October.
    expect(startOfDayInZone(now, "America/Los_Angeles").toISOString()).toBe("2026-10-14T07:00:00.000Z");
  });

  it("copes with daylight-saving days and unknown zones", () => {
    // Clocks went forward in Sydney on 2026-10-04, so that day began at 13:00Z on the 3rd (UTC+10).
    expect(startOfDayInZone(new Date("2026-10-04T05:00:00Z"), "Australia/Sydney").toISOString()).toBe("2026-10-03T14:00:00.000Z");
    expect(startOfDayInZone(new Date("2026-10-14T20:30:00Z"), "Not/AZone").toISOString()).toBe("2026-10-14T00:00:00.000Z");
  });
});

describe("voyage flow", () => {
  it("only allows sensible moves", () => {
    expect(canMoveVoyage("SCHEDULED", "BOARDING")).toBe(true);
    expect(canMoveVoyage("BOARDING", "DEPARTED")).toBe(true);
    expect(canMoveVoyage("DEPARTED", "ARRIVED")).toBe(true);
    expect(canMoveVoyage("DEPARTED", "SCHEDULED")).toBe(false);
    expect(canMoveVoyage("DEPARTED", "CANCELLED")).toBe(false);
    expect(canMoveVoyage("ARRIVED", "BOARDING")).toBe(false);
    expect(canMoveVoyage("CANCELLED", "SCHEDULED")).toBe(false);
  });
});

describe("dayRange", () => {
  it("covers exactly the local day, including 23-hour daylight-saving days", () => {
    const manila = dayRange("2026-10-15", "Asia/Manila")!;
    expect(manila.start.toISOString()).toBe("2026-10-14T16:00:00.000Z");
    expect(manila.end.toISOString()).toBe("2026-10-15T16:00:00.000Z");
    const sydney = dayRange("2026-10-04", "Australia/Sydney")!;
    expect((sydney.end.getTime() - sydney.start.getTime()) / 3_600_000).toBe(23);
  });

  it("rejects dates that don't exist", () => {
    expect(dayRange("2026-02-30", "UTC")).toBeNull();
    expect(dayRange("tomorrow", "UTC")).toBeNull();
  });

  it("formats today in the operator's zone", () => {
    expect(localDateString(new Date("2026-10-14T20:30:00Z"), "Asia/Manila")).toBe("2026-10-15");
  });
});

describe("csv", () => {
  it("quotes, escapes and defuses formulas", () => {
    const out = toCsv([["a,b", 'say "hi"', "=SUM(A1)", 5, null]]);
    expect(out).toBe('﻿"a,b","say ""hi""",\'=SUM(A1),5,\r\n');
  });
});

describe("ticket codes", () => {
  it("accepts genuine codes and rejects edited or invented ones", async () => {
    const { ticketCode, readTicketCode } = await import("@/lib/ticket-code");
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const code = ticketCode(id);
    expect(readTicketCode(code)).toBe(id);
    expect(readTicketCode(`  ${code}\n`)).toBe(id);
    expect(readTicketCode(`https://app.example.com/t/${code}?x=1`)).toBe(id);
    expect(readTicketCode(code.slice(0, -1) + (code.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(readTicketCode(code.replace(id, "1f8fad5b-d9cb-469f-a165-70867728950e"))).toBeNull();
    expect(readTicketCode("HL1.not-a-uuid.sig")).toBeNull();
    expect(readTicketCode("")).toBeNull();
  });
});

describe("field presets", () => {
  it("keeps chosen presets in order and any custom fields", async () => {
    const { buildFieldSchema } = await import("@/lib/field-presets");
    const custom = { key: "container_no", label: "Container number", type: "text" as const };
    const out = buildFieldSchema("CARGO", ["weight", "contents", "bogus"], [custom, { key: "fragile", label: "Fragile", type: "boolean" }]);
    expect(out.map((f) => f.key)).toEqual(["contents", "weight", "container_no"]);
  });
});
