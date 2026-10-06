import type { Tx } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Capacities, FieldDef, ItemKind, ManifestStatus } from "@/lib/domain";
import { usedCapacity } from "./bookings";

const voyageInclude = {
  vessel: { select: { name: true, capacities: true } },
  origin: { select: { name: true, code: true } },
  destination: { select: { name: true, code: true } },
} satisfies Prisma.VoyageInclude;

type VoyageWithRoute = Prisma.VoyageGetPayload<{ include: typeof voyageInclude }>;

const toVoyageRow = (v: VoyageWithRoute) => ({
  id: v.id,
  voyageNo: v.voyageNo,
  status: v.status,
  departureAt: v.departureAt,
  vesselName: v.vessel.name,
  capacities: v.vessel.capacities as Capacities,
  originName: v.origin.name,
  destinationName: v.destination.name,
  originCode: v.origin.code,
  destinationCode: v.destination.code,
});

export type VoyageRow = Awaited<ReturnType<typeof listUpcomingVoyages>>[number];

export async function listUpcomingVoyages(tx: Tx, opts: { limit?: number; includePast?: boolean } = {}) {
  const since = opts.includePast ? new Date(0) : new Date(Date.now() - 6 * 3600 * 1000);
  const rows = await tx.voyage.findMany({
    where: { departureAt: { gte: since } },
    include: voyageInclude,
    orderBy: { departureAt: "asc" },
    take: opts.limit ?? 50,
  });
  // Sequential on purpose: a transaction owns one connection, which runs one query at a time.
  const out = [];
  for (const v of rows) out.push({ ...toVoyageRow(v), used: await usedCapacity(tx, v.id) });
  return out;
}

export async function getVoyage(tx: Tx, id: string) {
  const v = await tx.voyage.findUnique({ where: { id }, include: voyageInclude });
  return v ? { ...toVoyageRow(v), used: await usedCapacity(tx, v.id) } : null;
}

export async function listBookings(tx: Tx, opts: { status?: string; voyageId?: string; limit?: number } = {}) {
  const rows = await tx.booking.findMany({
    where: { status: opts.status || undefined, voyageId: opts.voyageId || undefined },
    include: {
      voyage: { select: { id: true, voyageNo: true, departureAt: true, origin: { select: { name: true } }, destination: { select: { name: true } } } },
      invoice: { select: { status: true } },
    },
    orderBy: { bookingNo: "desc" },
    take: opts.limit ?? 100,
  });
  return rows.map((b) => ({
    id: b.id,
    bookingNo: b.bookingNo,
    contactName: b.contactName,
    status: b.status,
    reviewReason: b.reviewReason,
    total: b.total,
    currency: b.currency,
    source: b.source,
    createdAt: b.createdAt,
    voyageId: b.voyage.id,
    voyageNo: b.voyage.voyageNo,
    departureAt: b.voyage.departureAt,
    originName: b.voyage.origin.name,
    destinationName: b.voyage.destination.name,
    invoiceStatus: b.invoice?.status ?? null,
  }));
}

export async function getBookingDetail(tx: Tx, id: string) {
  const booking = await tx.booking.findUnique({ where: { id } });
  if (!booking) return null;
  const voyage = await getVoyage(tx, booking.voyageId);
  const lines = await tx.bookingLine.findMany({ where: { bookingId: id } });
  const invoice = await tx.invoice.findUnique({ where: { bookingId: id } });
  const paymentRows = invoice ? await tx.payment.findMany({ where: { invoiceId: invoice.id }, orderBy: { receivedAt: "asc" } }) : [];
  const types = lines.length ? await tx.itemType.findMany({ where: { id: { in: lines.map((l) => l.itemTypeId) } } }) : [];
  return { booking, voyage, lines, invoice, payments: paymentRows, types };
}

export async function dashboardStats(tx: Tx) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = await tx.booking.aggregate({
    where: { createdAt: { gte: startOfDay }, status: "CONFIRMED" },
    _count: { _all: true },
    _sum: { total: true },
  });
  const needsReview = await tx.booking.count({ where: { status: "NEEDS_REVIEW" } });
  const unpaidCount = await tx.invoice.count({ where: { status: { in: ["UNPAID", "PARTIAL"] } } });
  return { todayBookings: today._count._all, todayRevenue: today._sum.total ?? 0, needsReview, unpaidCount };
}

export async function voyageManifest(tx: Tx, voyageId: string) {
  const rows = await tx.manifestEntry.findMany({
    where: { voyageId },
    include: { bookingLine: { include: { booking: { select: { id: true, bookingNo: true, contactName: true } } } } },
    orderBy: [{ bookingLine: { kind: "asc" } }, { bookingLine: { booking: { bookingNo: "asc" } } }],
  });
  return rows.map((e) => ({
    entryId: e.id,
    status: e.status as ManifestStatus,
    receivedBy: e.receivedBy,
    description: e.bookingLine.description,
    quantity: e.bookingLine.quantity,
    kind: e.bookingLine.kind as ItemKind,
    attributes: e.bookingLine.attributes as Record<string, string | number | boolean>,
    itemTypeId: e.bookingLine.itemTypeId,
    bookingId: e.bookingLine.booking.id,
    bookingNo: e.bookingLine.booking.bookingNo,
    contactName: e.bookingLine.booking.contactName,
  }));
}

/** Everything the booking form needs to price a sale on screen. The offline desk caches exactly this. */
export async function bookingFormData(tx: Tx) {
  const voyageRows = await listUpcomingVoyages(tx, { limit: 40 });
  const open = voyageRows.filter((v) => v.status === "SCHEDULED" || v.status === "BOARDING");
  const types = await tx.itemType.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
  const rules = await tx.priceRule.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
  const taxes = await tx.taxRule.findMany({ where: { active: true } });
  const voyageIds = open.map((v) => v.id);
  const routes = voyageIds.length ? await tx.voyage.findMany({ where: { id: { in: voyageIds } }, select: { id: true, originId: true, destinationId: true } }) : [];
  const routeById = new Map(routes.map((r) => [r.id, r]));
  return {
    voyages: open.map((v) => ({
      id: v.id,
      label: `${v.originName} → ${v.destinationName}`,
      departureAt: v.departureAt.toISOString(),
      vesselName: v.vesselName,
      originId: routeById.get(v.id)!.originId,
      destinationId: routeById.get(v.id)!.destinationId,
      capacities: v.capacities,
      used: v.used,
    })),
    itemTypes: types.map((t) => ({ id: t.id, kind: t.kind as ItemKind, name: t.name, capacityUnits: t.capacityUnits, fieldSchema: t.fieldSchema as FieldDef[] })),
    priceRules: rules.map((r) => ({ itemTypeId: r.itemTypeId, originId: r.originId, destinationId: r.destinationId, unitPrice: r.unitPrice, active: r.active })),
    taxRules: taxes.map((t) => ({ name: t.name, rateBp: t.rateBp, appliesTo: t.appliesTo as "ALL" | ItemKind, inclusive: t.inclusive, active: t.active })),
  };
}
export type BookingFormData = Awaited<ReturnType<typeof bookingFormData>>;
