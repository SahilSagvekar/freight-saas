import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, DEFAULT_ROLES, type Permission } from "@/lib/domain";
import { homeFor, navFor, portalFor } from "@/lib/portals";
import { startOfDayInZone } from "@/lib/tz";
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
    expect(hrefs(role("Dock crew"))).toEqual(["/app/voyages", "/app/bookings"]);
    expect(hrefs(role("Booking agent"))).toContain("/app/desk");
    expect(hrefs(role("Booking agent"))).not.toContain("/app/review");
    expect(hrefs(role("Cashier"))).not.toContain("/app/settings");
    expect(hrefs(ALL_PERMISSIONS)).toEqual(["/app", "/app/desk", "/app/voyages", "/app/bookings", "/app/review", "/app/team", "/app/settings"]);
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
