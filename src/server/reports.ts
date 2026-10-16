import type { Tx } from "@/db";
import { PAYMENT_METHODS, type ItemKind, type PaymentMethod } from "@/lib/domain";
import { dayRange } from "@/lib/tz";

export type DailyReport = {
  date: string;
  bookings: { confirmed: number; cancelled: number; needsReview: number };
  sales: { subtotal: number; tax: number; total: number };
  collected: Record<PaymentMethod, number>;
  refunded: number;
  netCash: number;
  byCashier: { name: string; collected: number; refunded: number; net: number }[];
  byVoyage: { id: string; label: string; departureAt: Date; status: string; bookings: number; passengers: number; vehicles: number; cargo: number; cargoWeightKg: number; revenue: number }[];
  outstanding: { count: number; amount: number };
};

/** A numeric weight a cargo line carries under any of the usual field names; 0 when there isn't one. */
export function lineWeightKg(attributes: unknown, quantity: number): number {
  if (!attributes || typeof attributes !== "object") return 0;
  const a = attributes as Record<string, unknown>;
  for (const key of ["weight", "weight_kg", "weightKg"]) {
    const v = Number(a[key]);
    if (Number.isFinite(v) && v > 0) return v * quantity;
  }
  return 0;
}

/** Everything the end-of-day screen and CSV need, for one calendar day in the operator's time zone. */
export async function dailyReport(tx: Tx, ymd: string, timeZone: string): Promise<DailyReport | null> {
  const range = dayRange(ymd, timeZone);
  if (!range) return null;
  const { start, end } = range;

  const [bookingRows, payments, voyages, outstandingRows] = await Promise.all([
    tx.booking.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { status: true, subtotal: true, taxTotal: true, total: true } }),
    tx.payment.findMany({ where: { receivedAt: { gte: start, lt: end } }, select: { amount: true, method: true, receiver: { select: { name: true } } } }),
    tx.voyage.findMany({
      where: { departureAt: { gte: start, lt: end } },
      orderBy: { departureAt: "asc" },
      include: { origin: { select: { name: true } }, destination: { select: { name: true } } },
    }),
    tx.$queryRaw<{ n: bigint; amount: bigint | null }[]>`
      select count(*) as n, sum(i.total - coalesce(p.paid, 0)) as amount
      from invoices i
      left join (select invoice_id, sum(amount) as paid from payments group by invoice_id) p on p.invoice_id = i.id
      where i.status in ('UNPAID', 'PARTIAL')`,
  ]);

  const confirmed = bookingRows.filter((b) => b.status === "CONFIRMED");
  const sales = confirmed.reduce((a, b) => ({ subtotal: a.subtotal + b.subtotal, tax: a.tax + b.taxTotal, total: a.total + b.total }), { subtotal: 0, tax: 0, total: 0 });

  const collected = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as Record<PaymentMethod, number>;
  let refunded = 0;
  const cashiers = new Map<string, { collected: number; refunded: number }>();
  for (const p of payments) {
    const who = cashiers.get(p.receiver?.name ?? "Unknown") ?? { collected: 0, refunded: 0 };
    if (p.amount >= 0) {
      collected[p.method as PaymentMethod] = (collected[p.method as PaymentMethod] ?? 0) + p.amount;
      who.collected += p.amount;
    } else {
      refunded += -p.amount;
      who.refunded += -p.amount;
    }
    cashiers.set(p.receiver?.name ?? "Unknown", who);
  }
  const totalCollected = Object.values(collected).reduce((a, b) => a + b, 0);

  const voyageIds = voyages.map((v) => v.id);
  const lines = voyageIds.length
    ? await tx.bookingLine.findMany({ where: { booking: { voyageId: { in: voyageIds }, status: "CONFIRMED" } }, select: { kind: true, quantity: true, total: true, attributes: true, booking: { select: { id: true, voyageId: true } } } })
    : [];

  const byVoyage = voyages.map((v) => {
    const mine = lines.filter((l) => l.booking.voyageId === v.id);
    const sum = (kind: ItemKind) => mine.filter((l) => l.kind === kind).reduce((a, l) => a + l.quantity, 0);
    return {
      id: v.id,
      label: `${v.origin.name} → ${v.destination.name}`,
      departureAt: v.departureAt,
      status: v.status,
      bookings: new Set(mine.map((l) => l.booking.id)).size,
      passengers: sum("PASSENGER"),
      vehicles: sum("VEHICLE"),
      cargo: sum("CARGO"),
      cargoWeightKg: mine.filter((l) => l.kind === "CARGO").reduce((a, l) => a + lineWeightKg(l.attributes, l.quantity), 0),
      revenue: mine.reduce((a, l) => a + l.total, 0),
    };
  });

  return {
    date: ymd,
    bookings: { confirmed: confirmed.length, cancelled: bookingRows.filter((b) => b.status === "CANCELLED").length, needsReview: bookingRows.filter((b) => b.status === "NEEDS_REVIEW").length },
    sales,
    collected,
    refunded,
    netCash: totalCollected - refunded,
    byCashier: [...cashiers.entries()].map(([name, c]) => ({ name, ...c, net: c.collected - c.refunded })).sort((a, b) => b.net - a.net),
    byVoyage,
    outstanding: { count: Number(outstandingRows[0]?.n ?? 0), amount: Number(outstandingRows[0]?.amount ?? 0) },
  };
}
