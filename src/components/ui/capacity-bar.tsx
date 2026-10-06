import { cn } from "@/lib/utils";

/** Used vs total space. Turns amber when nearly full and red when full, so a glance tells you if there is room. */
export function CapacityBar({ label, used, capacity, compact }: { label: string; used: number; capacity: number; compact?: boolean }) {
  const ratio = capacity > 0 ? used / capacity : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const tone = ratio >= 1 ? "bg-danger-600" : ratio >= 0.85 ? "bg-warn-600" : "bg-brand-500";
  const left = Math.max(0, capacity - used);
  return (
    <div>
      <div className={cn("flex items-baseline justify-between gap-2", compact ? "text-xs" : "text-sm")}>
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular text-muted">
          {used} / {capacity}
          {!compact && <span className="ml-1.5 text-subtle">({left} left)</span>}
        </span>
      </div>
      <div
        className={cn("mt-1.5 overflow-hidden rounded-full bg-line", compact ? "h-1.5" : "h-2")}
        role="progressbar"
        aria-label={`${label} space used`}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={Math.min(used, capacity)}
      >
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
