import { toCsv } from "./csv";
import { fromMinor } from "./money";
import { MODE_LABELS, type TransportMode } from "./domain";
import { packageTotals, SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "./shipment";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const party = (j: unknown) => ((j ?? {}) as { name?: string }).name ?? "";

type ShipmentRow = {
  shipmentNo: number; status: string; mode: string; customerRef: string | null; shipper: unknown; consignee: unknown; origin: string; destination: string;
  incoterm: string | null; carrier: string | null; masterNo: string | null; houseNo: string | null; containerNo: string | null; etd: Date | null; eta: Date | null; goods: string; currency: string; createdAt: Date;
  packages: { quantity: number; lengthCm: number | null; widthCm: number | null; heightCm: number | null; grossWeightKg: number | null; declaredValue: number | null }[];
};

export function shipmentsCsv(rows: ShipmentRow[], label: (n: number) => string): string {
  const head = ["Shipment", "Status", "Mode", "Customer ref", "Shipper", "Consignee", "From", "To", "Incoterm", "Carrier", "Master B/L or MAWB", "House B/L or HAWB", "Container", "ETD", "ETA", "Goods", "Pieces", "Gross kg", "m3", "Declared value", "Currency", "Created"];
  const body = rows.map((r) => {
    const t = packageTotals(r.packages.map((p) => ({ quantity: p.quantity, packageType: "", description: "", lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm, grossWeightKg: p.grossWeightKg, marks: null, hsCode: null, declaredValue: p.declaredValue })));
    return [
      label(r.shipmentNo), SHIPMENT_STATUS_LABELS[r.status as ShipmentStatus] ?? r.status, MODE_LABELS[r.mode as TransportMode] ?? r.mode, r.customerRef, party(r.shipper), party(r.consignee), r.origin, r.destination,
      r.incoterm, r.carrier, r.masterNo, r.houseNo, r.containerNo, day(r.etd), day(r.eta), r.goods, t.pieces, t.grossKg, t.cbm, fromMinor(t.declaredValue, r.currency), r.currency, day(r.createdAt),
    ];
  });
  return toCsv([head, ...body]);
}

type InquiryRow = { inquiryNo: number; status: string; name: string; company: string | null; email: string; phone: string | null; mode: string; origin: string; destination: string; cargo: string; weightKg: number | null; readyOn: Date | null; message: string | null; createdAt: Date };

export function inquiriesCsv(rows: InquiryRow[], label: (n: number) => string): string {
  const head = ["Inquiry", "Status", "Name", "Company", "Email", "Phone", "Mode", "From", "To", "Cargo", "Weight kg", "Ready on", "Message", "Received"];
  const body = rows.map((r) => [label(r.inquiryNo), r.status, r.name, r.company, r.email, r.phone, MODE_LABELS[r.mode as TransportMode] ?? r.mode, r.origin, r.destination, r.cargo, r.weightKg, day(r.readyOn), r.message, day(r.createdAt)]);
  return toCsv([head, ...body]);
}
