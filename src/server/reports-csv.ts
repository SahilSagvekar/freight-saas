import { toCsv } from "@/lib/csv";
import { fromMinor } from "@/lib/money";
import type { DailyReport } from "./reports";

/** The daily report as one CSV an accountant can open: summary lines first, then per-cashier and per-voyage tables. */
export function dailyReportCsv(r: DailyReport, currency: string): string {
  const m = (minor: number) => fromMinor(minor, currency);
  return toCsv([
    ["Daily report", r.date],
    [],
    ["Bookings confirmed", r.bookings.confirmed],
    ["Bookings cancelled", r.bookings.cancelled],
    ["Bookings awaiting review", r.bookings.needsReview],
    ["Sales before tax", m(r.sales.subtotal)],
    ["Tax", m(r.sales.tax)],
    ["Sales total", m(r.sales.total)],
    ...Object.entries(r.collected).map(([method, amount]) => [`Collected (${method.replace("_", " ").toLowerCase()})`, m(amount)]),
    ["Refunded", m(r.refunded)],
    ["Net cash and card", m(r.netCash)],
    ["Unpaid invoices (all time)", r.outstanding.count],
    ["Still owed (all time)", m(r.outstanding.amount)],
    [],
    ["Cashier", "Collected", "Refunded", "Net"],
    ...r.byCashier.map((c) => [c.name, m(c.collected), m(c.refunded), m(c.net)]),
    [],
    ["Voyage", "Departure (UTC)", "Status", "Bookings", "Passengers", "Vehicles", "Cargo items", "Cargo kg", "Revenue"],
    ...r.byVoyage.map((v) => [v.label, v.departureAt.toISOString(), v.status, v.bookings, v.passengers, v.vehicles, v.cargo, v.cargoWeightKg || "", m(v.revenue)]),
  ]);
}
