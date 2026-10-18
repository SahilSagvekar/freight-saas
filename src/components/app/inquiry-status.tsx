import { Badge, type Tone } from "@/components/ui/badge";
import { INQUIRY_STATUS_LABELS, type InquiryStatus } from "@/lib/domain";

const TONES: Record<InquiryStatus, Tone> = { NEW: "warn", QUOTED: "brand", WON: "ok", LOST: "neutral" };

export function InquiryStatusBadge({ status }: { status: string }) {
  const known = status in TONES;
  return <Badge tone={known ? TONES[status as InquiryStatus] : "neutral"}>{known ? INQUIRY_STATUS_LABELS[status as InquiryStatus] : status}</Badge>;
}
