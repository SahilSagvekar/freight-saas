"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isUniqueViolation, withTenant } from "@/db";
import { ITEM_KINDS } from "@/lib/domain";
import { toMinor } from "@/lib/money";
import { requirePermission } from "./auth";
import type { ActionResult } from "./booking-actions";
import { BookingError } from "./bookings";
import { setTenantSetting } from "./shared";
import { createVoyage } from "./voyages";

async function guarded(permission: "settings.manage" | "voyage.manage", fn: (ctx: { tenantId: string; actorId: string; currency: string }, tx: Parameters<Parameters<typeof withTenant>[1]>[0]) => Promise<void>, message: string): Promise<ActionResult> {
  const auth = await requirePermission(permission);
  try {
    await withTenant(auth.tenantId, (tx) => fn({ tenantId: auth.tenantId, actorId: auth.userId, currency: auth.tenant.baseCurrency }, tx));
    revalidatePath("/app", "layout");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    // Unique-constraint clash, e.g. a second port with the same code.
    if (isUniqueViolation(e)) return { ok: false, error: "That name or code is already in use." };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const first = (r: { error: z.ZodError }) => r.error.issues[0]?.message ?? "Check the form and try again.";
const text = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function addLocationAction(f: FormData): Promise<ActionResult> {
  const p = z.object({ code: z.string().trim().min(2, "Code needs 2–6 letters").max(6).transform((s) => s.toUpperCase()), name: z.string().trim().min(1, "Enter a name").max(80) }).safeParse({ code: text(f, "code"), name: text(f, "name") });
  if (!p.success) return { ok: false, error: first(p) };
  return guarded("settings.manage", async (c, tx) => void (await tx.location.create({ data: { tenantId: c.tenantId, ...p.data } })), "Port added");
}

export async function addVesselAction(f: FormData): Promise<ActionResult> {
  const n = () => z.coerce.number().int().min(0, "Capacity can't be negative").max(100000);
  const p = z.object({ name: z.string().trim().min(1, "Enter a vessel name").max(80), PASSENGER: n(), VEHICLE: n(), CARGO: n() }).safeParse({ name: text(f, "name"), PASSENGER: text(f, "passengers") || "0", VEHICLE: text(f, "vehicles") || "0", CARGO: text(f, "cargo") || "0" });
  if (!p.success) return { ok: false, error: first(p) };
  const { name, ...capacities } = p.data;
  return guarded("settings.manage", async (c, tx) => void (await tx.vessel.create({ data: { tenantId: c.tenantId, name, capacities } })), "Vessel added");
}

export async function addItemTypeAction(f: FormData): Promise<ActionResult> {
  const kind = text(f, "kind");
  const p = z.object({ name: z.string().trim().min(1, "Enter a name").max(80), units: z.coerce.number().int().min(1).max(1000) }).safeParse({ name: text(f, "name"), units: text(f, "units") || "1" });
  if (!p.success || !ITEM_KINDS.includes(kind as never)) return { ok: false, error: p.success ? "Choose a type" : first(p) };
  return guarded("settings.manage", async (c, tx) => {
    const price = toMinor(text(f, "price") || "0", c.currency);
    if (price === null) throw new BookingError("INVALID", "Enter a price like 25.00");
    const t = await tx.itemType.create({ data: { tenantId: c.tenantId, kind, name: p.data.name, capacityUnits: p.data.units } });
    await tx.priceRule.create({ data: { tenantId: c.tenantId, itemTypeId: t.id, unitPrice: price } });
  }, "Item added");
}

export async function setPriceAction(f: FormData): Promise<ActionResult> {
  const itemTypeId = z.string().uuid().safeParse(text(f, "itemTypeId"));
  if (!itemTypeId.success) return { ok: false, error: "Unknown item" };
  return guarded("settings.manage", async (c, tx) => {
    const price = toMinor(text(f, "price"), c.currency);
    if (price === null) throw new BookingError("INVALID", "Enter a price like 25.00");
    await tx.priceRule.updateMany({ where: { itemTypeId: itemTypeId.data, originId: null, destinationId: null }, data: { active: false } });
    await tx.priceRule.create({ data: { tenantId: c.tenantId, itemTypeId: itemTypeId.data, unitPrice: price } });
  }, "Price updated");
}

export async function addTaxAction(f: FormData): Promise<ActionResult> {
  const p = z.object({ name: z.string().trim().min(1, "Enter a tax name").max(60), rate: z.coerce.number().min(0, "Rate can't be negative").max(100, "Rate can't exceed 100%") }).safeParse({ name: text(f, "name"), rate: text(f, "rate") });
  if (!p.success) return { ok: false, error: first(p) };
  const appliesTo = ["ALL", ...ITEM_KINDS].includes(text(f, "appliesTo")) ? text(f, "appliesTo") : "ALL";
  return guarded("settings.manage", async (c, tx) => void (await tx.taxRule.create({ data: { tenantId: c.tenantId, name: p.data.name, rateBp: Math.round(p.data.rate * 100), appliesTo, inclusive: f.get("inclusive") === "on" } })), "Tax added");
}

export async function toggleTaxAction(id: string, active: boolean): Promise<ActionResult> {
  return guarded("settings.manage", async (_c, tx) => void (await tx.taxRule.updateMany({ where: { id }, data: { active } })), active ? "Tax turned on" : "Tax turned off");
}

export async function saveGeneralAction(f: FormData): Promise<ActionResult> {
  const p = z.object({ oversell: z.coerce.number().min(0, "Enter 0 or more").max(50, "Keep this at 50% or less") }).safeParse({ oversell: text(f, "oversell") });
  if (!p.success) return { ok: false, error: first(p) };
  return guarded("settings.manage", (c, tx) => setTenantSetting(tx, c.tenantId, "oversellPercent", p.data.oversell), "Settings saved");
}

export async function createVoyageAction(f: FormData): Promise<ActionResult & { id?: string }> {
  const p = z.object({ vesselId: z.string().uuid("Choose a vessel"), originId: z.string().uuid("Choose where it departs from"), destinationId: z.string().uuid("Choose where it arrives"), departureAt: z.coerce.date({ error: "Enter a departure date and time" }) }).safeParse({ vesselId: text(f, "vesselId"), originId: text(f, "originId"), destinationId: text(f, "destinationId"), departureAt: text(f, "departureAt") });
  if (!p.success) return { ok: false, error: first(p) };
  let id: string | undefined;
  const res = await guarded("voyage.manage", async (c, tx) => { id = (await createVoyage(tx, { tenantId: c.tenantId, actorId: c.actorId }, p.data)).id; }, "Voyage scheduled");
  return { ...res, id };
}
