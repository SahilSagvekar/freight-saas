import { Badge, type Tone } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS, type InvoiceStatus, type QuoteStatus } from "@/lib/freight-billing";

const QUOTE_TONES: Record<QuoteStatus, Tone> = { DRAFT: "neutral", SENT: "brand", ACCEPTED: "ok", REJECTED: "danger" };
const INVOICE_TONES: Record<InvoiceStatus, Tone> = { UNPAID: "warn", PAID: "ok", VOID: "neutral" };

export function QuoteStatusBadge({ status }: { status: string }) {
  const known = status in QUOTE_TONES;
  return <Badge tone={known ? QUOTE_TONES[status as QuoteStatus] : "neutral"}>{known ? QUOTE_STATUS_LABELS[status as QuoteStatus] : status}</Badge>;
}

export function InvoiceStatusBadge({ status, overdue = false }: { status: string; overdue?: boolean }) {
  if (overdue) return <Badge tone="danger">Overdue</Badge>;
  const known = status in INVOICE_TONES;
  return <Badge tone={known ? INVOICE_TONES[status as InvoiceStatus] : "neutral"}>{known ? INVOICE_STATUS_LABELS[status as InvoiceStatus] : status}</Badge>;
}
