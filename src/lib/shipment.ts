import type { TransportMode } from "./domain";

/** Shipments are always air, ocean or ground. "Not sure" exists only on the website form. */
export const SHIPMENT_MODES = ["OCEAN", "AIR", "GROUND"] as const satisfies readonly TransportMode[];
export type ShipmentMode = (typeof SHIPMENT_MODES)[number];

export const SHIPMENT_STATUSES = ["BOOKED", "PICKED_UP", "IN_TRANSIT", "ARRIVED", "CLEARED", "DELIVERED", "CANCELLED"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  BOOKED: "Booked",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  ARRIVED: "Arrived",
  CLEARED: "Cleared customs",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Statuses a shipment can still move on from, as opposed to finished ones. */
export const ACTIVE_SHIPMENT_STATUSES: readonly ShipmentStatus[] = ["BOOKED", "PICKED_UP", "IN_TRANSIT", "ARRIVED", "CLEARED"];

const NEXT: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  BOOKED: ["PICKED_UP", "IN_TRANSIT", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["CLEARED", "DELIVERED", "CANCELLED"],
  CLEARED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: ["BOOKED"],
};

/** The statuses a shipment may be moved to from its current one. Delivered is final; a cancelled shipment can be reopened. */
export const nextShipmentStatuses = (from: string): readonly ShipmentStatus[] => NEXT[from as ShipmentStatus] ?? [];
export const canMoveShipment = (from: string, to: string) => nextShipmentStatuses(from).includes(to as ShipmentStatus);

/** Incoterms 2020. */
export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;

export const PACKAGE_TYPES = ["Pallet", "Carton", "Crate", "Drum", "Bag", "Bundle", "Container", "Other"] as const;

/** A shipper, consignee or notify party. Printed as typed on the documents. */
export type Party = { name: string; address: string; phone?: string; email?: string; taxId?: string };

export type PackageLine = {
  quantity: number;
  packageType: string;
  description: string;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  /** Total gross weight of this line (all pieces together), in kilograms. */
  grossWeightKg?: number | null;
  marks?: string | null;
  hsCode?: string | null;
  /** Declared value of this line in minor units of the shipment's currency. */
  declaredValue?: number | null;
};

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Volume of one line in cubic metres: pieces × length × width × height. Zero if a dimension is missing. */
export function lineVolumeCbm(p: Pick<PackageLine, "quantity" | "lengthCm" | "widthCm" | "heightCm">): number {
  const { lengthCm: l, widthCm: w, heightCm: h } = p;
  if (!l || !w || !h) return 0;
  return (p.quantity * l * w * h) / 1_000_000;
}

export type PackageTotals = { pieces: number; grossKg: number; cbm: number; declaredValue: number; linesWithoutWeight: number };

export function packageTotals(lines: readonly PackageLine[]): PackageTotals {
  let pieces = 0;
  let grossKg = 0;
  let cbm = 0;
  let declaredValue = 0;
  let linesWithoutWeight = 0;
  for (const l of lines) {
    pieces += l.quantity;
    grossKg += l.grossWeightKg ?? 0;
    cbm += lineVolumeCbm(l);
    declaredValue += l.declaredValue ?? 0;
    if (!l.grossWeightKg) linesWithoutWeight += 1;
  }
  return { pieces, grossKg: round(grossKg, 3), cbm: round(cbm, 3), declaredValue, linesWithoutWeight };
}

/** Air freight is charged on the larger of actual weight and volume weight (1 m³ counts as 167 kg). */
export function airChargeableKg(totals: Pick<PackageTotals, "grossKg" | "cbm">): number {
  return round(Math.max(totals.grossKg, totals.cbm * 167), 1);
}

/** "2026-12-31" → a Date at midnight UTC, or null. Dates without a time are stored as plain calendar days. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  // 2026-02-31 would silently roll into March; only accept a day that survives the round trip.
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

export const dayString = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export type LabelPiece = { n: number; of: number; packageType: string; description: string; marks: string | null };

/** One entry per physical piece, numbered across the whole shipment ("3 of 14"). Stops at `cap` so a typo can't print thousands of labels. */
export function labelPieces(lines: readonly PackageLine[], cap = 500): { pieces: LabelPiece[]; total: number; truncated: boolean } {
  const total = lines.reduce((n, l) => n + l.quantity, 0);
  const pieces: LabelPiece[] = [];
  for (const l of lines) {
    for (let i = 0; i < l.quantity && pieces.length < cap; i++) pieces.push({ n: pieces.length + 1, of: total, packageType: l.packageType, description: l.description, marks: l.marks ?? null });
  }
  return { pieces, total, truncated: total > cap };
}

/** The document title for a mode: the house bill is a Bill of Lading by sea, an air waybill by air, a consignment note by road. */
export const TRANSPORT_DOC_TITLE: Record<ShipmentMode, string> = { OCEAN: "Bill of Lading", AIR: "House Air Waybill", GROUND: "Road Consignment Note" };
