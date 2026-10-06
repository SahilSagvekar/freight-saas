import { randomUUID } from "node:crypto";
import { provisionTenant } from "@/server/provision";

let counter = 0;

/** Creates a fresh operator with an owner account; each call gets unique names so tests never collide. */
export async function makeTenant(label = "Operator", overrides: { currency?: string } = {}) {
  const n = ++counter;
  const email = `owner-${n}-${randomUUID().slice(0, 8)}@example.test`;
  const result = await provisionTenant({
    name: `${label} ${n}`,
    baseCurrency: overrides.currency ?? "USD",
    owner: { name: `${label} Owner`, email, password: "password-for-tests" },
  });
  return { ...result, email, password: "password-for-tests", name: `${label} ${n}` };
}

import { withTenant } from "@/db";
import type { Capacities } from "@/lib/domain";
import { createVoyage } from "@/server/voyages";

/** A tenant with a vessel, two ports and one open voyage, plus a lookup for the starter item types. */
export async function makeOperation(capacities: Capacities = { PASSENGER: 100, VEHICLE: 10, CARGO: 20 }) {
  const tenant = await makeTenant("Ferry");
  const ctx = { tenantId: tenant.tenantId, actorId: tenant.ownerUserId };

  const setup = await withTenant(tenant.tenantId, async (tx) => {
    const origin = await tx.location.create({ data: { tenantId: tenant.tenantId, code: "NAS", name: "Nassau" } });
    const destination = await tx.location.create({ data: { tenantId: tenant.tenantId, code: "EXU", name: "Exuma" } });
    const vessel = await tx.vessel.create({ data: { tenantId: tenant.tenantId, name: "MV Test", capacities } });
    const voyage = await createVoyage(tx, ctx, {
      vesselId: vessel.id,
      originId: origin.id,
      destinationId: destination.id,
      departureAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
    });
    const types = await tx.itemType.findMany({ where: { tenantId: tenant.tenantId } });
    return { origin, destination, vessel, voyage, types };
  });

  const type = (name: string) => {
    const found = setup.types.find((t) => t.name === name);
    if (!found) throw new Error(`No starter item type named ${name}`);
    return found;
  };
  return { ...tenant, ctx, ...setup, type };
}

export async function addTax(tenantId: string, rule: { name: string; rateBp: number; inclusive?: boolean }) {
  await withTenant(tenantId, (tx) =>
    tx.taxRule.create({ data: { tenantId, name: rule.name, rateBp: rule.rateBp, inclusive: rule.inclusive ?? false } }),
  );
}

