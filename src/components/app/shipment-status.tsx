import { Badge, type Tone } from "@/components/ui/badge";
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/lib/shipment";

const TONES: Record<ShipmentStatus, Tone> = { BOOKED: "neutral", PICKED_UP: "brand", IN_TRANSIT: "brand", ARRIVED: "warn", CLEARED: "warn", DELIVERED: "ok", CANCELLED: "danger" };

export function ShipmentStatusBadge({ status }: { status: string }) {
  const known = status in TONES;
  return <Badge tone={known ? TONES[status as ShipmentStatus] : "neutral"}>{known ? SHIPMENT_STATUS_LABELS[status as ShipmentStatus] : status}</Badge>;
}
