import { afterAll, describe, expect, it } from "vitest";
import { closeDb, withTenant } from "@/db";
import { createInquiry, inquiryCounts, listInquiries, setInquiryNotes, setInquiryStatus } from "@/server/inquiries";
import { getTenantConfig, setTenantSetting } from "@/server/shared";
import { makeTenant } from "./helpers";

afterAll(closeDb);

const input = { name: "Priya Shah", email: "Priya@Acme.test", mode: "OCEAN" as const, origin: "Mumbai", destination: "Dubai", cargo: "12 pallets of tiles" };

describe("inquiries", () => {
  it("numbers inquiries per operator, starting at 1", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");
    const make = (t: typeof a) => withTenant(t.tenantId, (tx) => createInquiry(tx, { tenantId: t.tenantId, actorId: null, source: "FORM" }, input));
    expect((await make(a)).inquiryNo).toBe(1);
    expect((await make(a)).inquiryNo).toBe(2);
    expect((await make(b)).inquiryNo).toBe(1);
  });

  it("stores a clean row: lower-case email, blanks as null, new status", async () => {
    const t = await makeTenant("Alpha");
    const row = await withTenant(t.tenantId, (tx) => createInquiry(tx, { tenantId: t.tenantId, actorId: null, source: "FORM" }, { ...input, phone: "", company: "", message: "", readyOn: "2026-12-31", weightKg: 500 }));
    expect(row.email).toBe("priya@acme.test");
    expect(row.phone).toBeNull();
    expect(row.company).toBeNull();
    expect(row.status).toBe("NEW");
    expect(row.weightKg).toBe(500);
    expect(row.readyOn?.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("keeps each operator's inquiries private to them", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");
    const made = await withTenant(a.tenantId, (tx) => createInquiry(tx, { tenantId: a.tenantId, actorId: null, source: "FORM" }, input));

    expect(await withTenant(b.tenantId, (tx) => listInquiries(tx))).toEqual([]);
    expect(await withTenant(b.tenantId, (tx) => tx.inquiry.findUnique({ where: { id: made.id } }))).toBeNull();
    await expect(
      withTenant(b.tenantId, (tx) => createInquiry(tx, { tenantId: a.tenantId, actorId: null, source: "FORM" }, input)),
    ).rejects.toThrow();
  });

  it("moves through statuses, filters by status and counts them", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    const one = await withTenant(t.tenantId, (tx) => createInquiry(tx, { ...ctx, actorId: null, source: "FORM" }, input));
    await withTenant(t.tenantId, (tx) => createInquiry(tx, { ...ctx, actorId: null, source: "FORM" }, input));

    expect(await withTenant(t.tenantId, (tx) => setInquiryStatus(tx, ctx, one.id, "QUOTED"))).toBe(true);
    expect(await withTenant(t.tenantId, (tx) => inquiryCounts(tx))).toEqual({ NEW: 1, QUOTED: 1, WON: 0, LOST: 0 });
    expect((await withTenant(t.tenantId, (tx) => listInquiries(tx, { status: "QUOTED" }))).map((r) => r.id)).toEqual([one.id]);
    // An unknown filter is ignored rather than hiding everything.
    expect(await withTenant(t.tenantId, (tx) => listInquiries(tx, { status: "bogus" }))).toHaveLength(2);
    expect(await withTenant(t.tenantId, (tx) => setInquiryStatus(tx, ctx, "00000000-0000-0000-0000-000000000000", "WON"))).toBe(false);
  });

  it("saves and clears private notes", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    const row = await withTenant(t.tenantId, (tx) => createInquiry(tx, { ...ctx, actorId: null, source: "FORM" }, input));
    await withTenant(t.tenantId, (tx) => setInquiryNotes(tx, ctx, row.id, "  call back Monday  "));
    expect((await withTenant(t.tenantId, (tx) => tx.inquiry.findUniqueOrThrow({ where: { id: row.id } }))).notes).toBe("call back Monday");
    await withTenant(t.tenantId, (tx) => setInquiryNotes(tx, ctx, row.id, "   "));
    expect((await withTenant(t.tenantId, (tx) => tx.inquiry.findUniqueOrThrow({ where: { id: row.id } }))).notes).toBeNull();
  });

  it("is off until the operator turns the form on", async () => {
    const t = await makeTenant("Alpha");
    expect((await withTenant(t.tenantId, (tx) => getTenantConfig(tx))).inquiryEnabled).toBe(false);
    await withTenant(t.tenantId, (tx) => setTenantSetting(tx, t.tenantId, "inquiryEnabled", true));
    const config = await withTenant(t.tenantId, (tx) => getTenantConfig(tx));
    expect(config.inquiryEnabled).toBe(true);
    expect(config.inquiryThanks.length).toBeGreaterThan(0);
  });
});
