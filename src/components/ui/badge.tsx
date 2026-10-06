import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "brand" | "ok" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-line/70 text-muted",
  brand: "bg-brand-100 text-brand-800",
  ok: "bg-ok-100 text-ok-700",
  warn: "bg-warn-100 text-warn-700",
  danger: "bg-danger-100 text-danger-700",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

const STATUS_TONES: Record<string, { tone: Tone; label: string }> = {
  CONFIRMED: { tone: "ok", label: "Confirmed" },
  NEEDS_REVIEW: { tone: "warn", label: "Needs review" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
  SCHEDULED: { tone: "brand", label: "Scheduled" },
  BOARDING: { tone: "warn", label: "Boarding" },
  DEPARTED: { tone: "brand", label: "Departed" },
  ARRIVED: { tone: "ok", label: "Arrived" },
  UNPAID: { tone: "danger", label: "Unpaid" },
  PARTIAL: { tone: "warn", label: "Part paid" },
  PAID: { tone: "ok", label: "Paid" },
  VOID: { tone: "neutral", label: "Void" },
  PENDING: { tone: "neutral", label: "Waiting" },
  LOADED: { tone: "brand", label: "Loaded" },
  UNLOADED: { tone: "warn", label: "Unloaded" },
  DELIVERED: { tone: "ok", label: "Delivered" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_TONES[status] ?? { tone: "neutral" as Tone, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
