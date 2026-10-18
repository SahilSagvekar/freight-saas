import type { Tx } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import type { ShipmentInput } from "@/lib/schemas";
import { ACTIVE_SHIPMENT_STATUSES, canMoveShipment, parseDay, SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS, type PackageLine, type Party, type ShipmentMode, type ShipmentStatus } from "@/lib/shipment";
import { audit, nextNumber } from "./shared";

type Ctx = { tenantId: string; actorId: string | null };

const blank = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);

function partyJson(p: ShipmentInput["shipper"]): Prisma.InputJsonObject {
  return { name: p.name, address: p.address, phone: blank(p.phone) ?? "", email: blank(p.email) ?? "", taxId: blank(p.taxId) ?? "" };
}

function packageRows(tenantId: string, shipmentId: string, lines: ShipmentInput["packages"]) {
  return lines.map((l, i) => ({
    tenantId,
    shipmentId,
    sortOrder: i,
    quantity: l.quantity,
    packageType: l.packageType,
    description: l.description,
    lengthCm: l.lengthCm ?? null,
    widthCm: l.widthCm ?? null,
    heightCm: l.heightCm ?? null,
    grossWeightKg: l.grossWeightKg ?? null,
    marks: blank(l.marks),
    hsCode: blank(l.hsCode),
    declaredValue: l.declaredValue ?? null,
  }));
}

function shipmentData(input: ShipmentInput) {
  const notify = input.notifyParty && input.notifyParty.name.trim() !== "" ? partyJson(input.notifyParty) : null;
  return {
    mode: input.mode,
    customerRef: blank(input.customerRef),
    shipper: partyJson(input.shipper),
    consignee: partyJson(input.consignee),
    notifyParty: notify ?? Prisma.DbNull,
    origin: input.origin,
    destination: input.destination,
    incoterm: blank(input.incoterm),
    carrier: blank(input.carrier),
    vesselOrFlight: blank(input.vesselOrFlight),
    voyageNo: blank(input.voyageNo),
    masterNo: blank(input.masterNo),
    houseNo: blank(input.houseNo),
    containerNo: blank(input.containerNo),
    sealNo: blank(input.sealNo),
    etd: parseDay(input.etd),
    eta: parseDay(input.eta),
    goods: input.goods,
    marks: blank(input.marks),
    currency: input.currency,
    notes: blank(input.notes),
  };
}

export async function createShipment(tx: Tx, ctx: Ctx, input: ShipmentInput, links: { inquiryId?: string; quoteId?: string } = {}) {
  const shipmentNo = await nextNumber(tx, ctx.tenantId, "shipment");
  const data = shipmentData(input);
  const row = await tx.shipment.create({
    data: { tenantId: ctx.tenantId, shipmentNo, ...data, inquiryId: links.inquiryId ?? null, quoteId: links.quoteId ?? null },
  });
  await tx.shipmentPackage.createMany({ data: packageRows(ctx.tenantId, row.id, input.packages) });
  await tx.shipmentEvent.create({ data: { tenantId: ctx.tenantId, shipmentId: row.id, status: "BOOKED", note: "Shipment created", actorId: ctx.actorId } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "shipment.create", entity: "shipment", entityId: row.id, after: { shipmentNo, mode: input.mode } });
  return row;
}

/** Saves every field and replaces the package lines, so the edit screen is the one source of truth. Status has its own action. */
export async function updateShipment(tx: Tx, ctx: Ctx, id: string, input: ShipmentInput) {
  const before = await tx.shipment.findUnique({ where: { id }, select: { id: true } });
  if (!before) return null;
  const data = shipmentData(input);
  const row = await tx.shipment.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  await tx.shipmentPackage.deleteMany({ where: { shipmentId: id } });
  await tx.shipmentPackage.createMany({ data: packageRows(ctx.tenantId, id, input.packages) });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "shipment.update", entity: "shipment", entityId: id });
  return row;
}

export type ShipmentFilter = { status?: string; q?: string; limit?: number };

/** "active" means anything not yet delivered or cancelled. Anything unknown is ignored rather than hiding everything. */
export async function listShipments(tx: Tx, f: ShipmentFilter = {}) {
  const status = f.status === "active" ? { in: [...ACTIVE_SHIPMENT_STATUSES] } : SHIPMENT_STATUSES.includes(f.status as ShipmentStatus) ? f.status : undefined;
  const q = f.q?.trim();
  const noMatch = q?.match(/^(?:sh-?)?0*(\d{1,9})$/i);
  const text = q ? { contains: q, mode: "insensitive" as const } : undefined;
  return tx.shipment.findMany({
    where: {
      status,
      ...(q
        ? { OR: [...(noMatch ? [{ shipmentNo: Number(noMatch[1]) }] : []), { customerRef: text }, { houseNo: text }, { masterNo: text }, { containerNo: text }, { origin: text }, { destination: text }, { goods: text }] }
        : {}),
    },
    include: { packages: { select: { quantity: true, grossWeightKg: true } } },
    orderBy: { createdAt: "desc" },
    take: f.limit ?? 200,
  });
}

export async function shipmentCounts(tx: Tx) {
  const rows = await tx.shipment.groupBy({ by: ["status"], _count: { _all: true } });
  const by: Record<string, number> = {};
  for (const r of rows) by[r.status] = r._count._all;
  const active = ACTIVE_SHIPMENT_STATUSES.reduce((n, s) => n + (by[s] ?? 0), 0);
  return { by, active, all: Object.values(by).reduce((a, b) => a + b, 0) };
}

export async function getShipment(tx: Tx, id: string) {
  return tx.shipment.findUnique({
    where: { id },
    include: { packages: { orderBy: { sortOrder: "asc" } }, events: { orderBy: { createdAt: "desc" } } },
  });
}

export const partyOf = (json: unknown): Party => {
  const p = (json ?? {}) as Partial<Party>;
  return { name: p.name ?? "", address: p.address ?? "", phone: p.phone ?? "", email: p.email ?? "", taxId: p.taxId ?? "" };
};

export const packageLinesOf = (rows: { quantity: number; packageType: string; description: string; lengthCm: number | null; widthCm: number | null; heightCm: number | null; grossWeightKg: number | null; marks: string | null; hsCode: string | null; declaredValue: number | null }[]): PackageLine[] =>
  rows.map((r) => ({ quantity: r.quantity, packageType: r.packageType, description: r.description, lengthCm: r.lengthCm, widthCm: r.widthCm, heightCm: r.heightCm, grossWeightKg: r.grossWeightKg, marks: r.marks, hsCode: r.hsCode, declaredValue: r.declaredValue }));

export type StatusChange = { ok: true; shipment: { id: string; shipmentNo: number; status: string } } | { ok: false; error: string };

export async function setShipmentStatus(tx: Tx, ctx: Ctx, id: string, to: string, extra: { note?: string; location?: string } = {}): Promise<StatusChange> {
  const row = await tx.shipment.findUnique({ where: { id }, select: { id: true, shipmentNo: true, status: true } });
  if (!row) return { ok: false, error: "That shipment no longer exists." };
  if (!canMoveShipment(row.status, to)) {
    return { ok: false, error: `A shipment that is ${SHIPMENT_STATUS_LABELS[row.status as ShipmentStatus]?.toLowerCase() ?? row.status} can't be marked ${SHIPMENT_STATUS_LABELS[to as ShipmentStatus]?.toLowerCase() ?? to}.` };
  }
  await tx.shipment.update({ where: { id }, data: { status: to, updatedAt: new Date() } });
  await tx.shipmentEvent.create({ data: { tenantId: ctx.tenantId, shipmentId: id, status: to, note: blank(extra.note), location: blank(extra.location), actorId: ctx.actorId } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "shipment.status", entity: "shipment", entityId: id, before: { status: row.status }, after: { status: to } });
  return { ok: true, shipment: { id, shipmentNo: row.shipmentNo, status: to } };
}

/**
 * Starts a shipment from a website inquiry, filled in as far as the inquiry allows. The inquiry becomes "won".
 * Asked twice for the same inquiry it returns the shipment that already exists instead of making a duplicate.
 */
export async function createShipmentFromInquiry(tx: Tx, ctx: Ctx, inquiryId: string, currency: string): Promise<{ id: string; created: boolean } | null> {
  const inq = await tx.inquiry.findUnique({ where: { id: inquiryId } });
  if (!inq) return null;
  const existing = await tx.shipment.findFirst({ where: { inquiryId }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };

  // "Not sure yet" has to become something; staff are sent straight to the edit screen to correct it.
  const mode: ShipmentMode = inq.mode === "AIR" || inq.mode === "GROUND" ? inq.mode : "OCEAN";
  const input: ShipmentInput = {
    mode,
    customerRef: "",
    shipper: { name: inq.company || inq.name, address: "", phone: inq.phone ?? "", email: inq.email, taxId: "" },
    consignee: { name: "", address: "", phone: "", email: "", taxId: "" },
    notifyParty: null,
    origin: inq.origin,
    destination: inq.destination,
    incoterm: "",
    carrier: "",
    vesselOrFlight: "",
    voyageNo: "",
    masterNo: "",
    houseNo: "",
    containerNo: "",
    sealNo: "",
    etd: inq.readyOn ? inq.readyOn.toISOString().slice(0, 10) : "",
    eta: "",
    goods: inq.cargo,
    marks: "",
    currency,
    notes: inq.message ?? "",
    packages: [{ quantity: 1, packageType: "Other", description: inq.cargo.slice(0, 300), grossWeightKg: inq.weightKg ?? null, lengthCm: null, widthCm: null, heightCm: null, marks: "", hsCode: "", declaredValue: null }],
  };
  const row = await createShipment(tx, ctx, input, { inquiryId });
  if (inq.status !== "WON") {
    await tx.inquiry.update({ where: { id: inquiryId }, data: { status: "WON", updatedAt: new Date() } });
    await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "inquiry.status", entity: "inquiry", entityId: inquiryId, before: { status: inq.status }, after: { status: "WON" } });
  }
  return { id: row.id, created: true };
}
