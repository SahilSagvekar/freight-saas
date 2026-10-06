import { afterAll, describe, expect, it } from "vitest";
import { adminDb, appDb, closeDb, withTenant } from "@/db";
import { makeTenant } from "./helpers";

afterAll(closeDb);

describe("tenant isolation (row-level security)", () => {
  it("each tenant only sees its own rows", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");

    await withTenant(a.tenantId, (tx) => tx.location.create({ data: { tenantId: a.tenantId, code: "AAA", name: "Alpha Port" } }));
    await withTenant(b.tenantId, (tx) => tx.location.create({ data: { tenantId: b.tenantId, code: "BBB", name: "Bravo Port" } }));

    const seenByA = await withTenant(a.tenantId, (tx) => tx.location.findMany());
    const seenByB = await withTenant(b.tenantId, (tx) => tx.location.findMany());
    expect(seenByA.map((l) => l.code)).toEqual(["AAA"]);
    expect(seenByB.map((l) => l.code)).toEqual(["BBB"]);

    // Starter catalogue is isolated too.
    const typesA = await withTenant(a.tenantId, (tx) => tx.itemType.findMany());
    expect(typesA.length).toBeGreaterThan(0);
    expect(typesA.every((t) => t.tenantId === a.tenantId)).toBe(true);
  });

  it("a tenant cannot write rows into another tenant", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");

    await expect(
      withTenant(a.tenantId, (tx) => tx.location.create({ data: { tenantId: b.tenantId, code: "EVIL", name: "Injected" } })),
    ).rejects.toThrow();

    const inB = await withTenant(b.tenantId, (tx) => tx.location.findMany());
    expect(inB.find((l) => l.code === "EVIL")).toBeUndefined();
  });

  it("a forgotten tenant context returns nothing instead of everything", async () => {
    await makeTenant("Alpha");
    const rows = await appDb().itemType.findMany();
    expect(rows).toHaveLength(0);
  });

  it("a tenant cannot update or delete another tenant's rows, even by id", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");
    const loc = await withTenant(b.tenantId, (tx) =>
      tx.location.create({ data: { tenantId: b.tenantId, code: "KEEP", name: "Keep me" } }),
    );

    // Row-level security hides the row from the other tenant, so nothing matches and nothing changes.
    const updated = await withTenant(a.tenantId, (tx) => tx.location.updateMany({ where: { id: loc.id }, data: { name: "Hijacked" } }));
    const deleted = await withTenant(a.tenantId, (tx) => tx.location.deleteMany({ where: { id: loc.id } }));
    expect(updated.count).toBe(0);
    expect(deleted.count).toBe(0);

    const still = await withTenant(b.tenantId, (tx) => tx.location.findUniqueOrThrow({ where: { id: loc.id } }));
    expect(still.name).toBe("Keep me");
  });

  it("users are visible only to their own tenant, and password hashes are never readable", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");

    const visible = await withTenant(a.tenantId, (tx) => tx.user.findMany({ select: { id: true, email: true } }));
    expect(visible.map((u) => u.email)).toEqual([a.email]);
    expect(visible.map((u) => u.email)).not.toContain(b.email);

    await expect(withTenant(a.tenantId, (tx) => tx.user.findMany({ select: { passwordHash: true } }))).rejects.toThrow();
  });

  it("a tenant sees only itself and cannot change its currency", async () => {
    const a = await makeTenant("Alpha");
    await makeTenant("Bravo");

    const rows = await withTenant(a.tenantId, (tx) => tx.tenant.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(a.tenantId);

    await expect(
      withTenant(a.tenantId, (tx) => tx.tenant.update({ where: { id: a.tenantId }, data: { baseCurrency: "EUR" } })),
    ).rejects.toThrow();
  });

  it("rejects a malformed tenant id before touching the database", async () => {
    await expect(withTenant("not-a-uuid", async () => 1)).rejects.toThrow("invalid tenant id");
  });

  it("platform (admin) access sees every tenant for provisioning and support", async () => {
    await makeTenant("Alpha");
    await makeTenant("Bravo");
    const all = await adminDb().tenant.findMany();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
