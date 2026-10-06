import { ArrowRight, Ship } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { formatDeparture } from "@/lib/format";
import type { VoyageRow } from "@/server/queries";

export function VoyageCard({ v }: { v: VoyageRow }) {
  return (
    <Link
      href={`/app/voyages/${v.id}`}
      className="group block rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card transition hover:border-brand-300 hover:shadow-pop"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 text-base font-semibold text-ink">
            <span>{v.originName}</span>
            <ArrowRight className="size-4 shrink-0 text-subtle" aria-hidden />
            <span>{v.destinationName}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted">{formatDeparture(v.departureAt)}</p>
        </div>
        <StatusBadge status={v.status} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted"><Ship className="size-4" aria-hidden />{v.vesselName}</p>
      <div className="mt-4 space-y-2.5">
        <CapacityBar compact label="Passengers" used={v.used.PASSENGER} capacity={v.capacities.PASSENGER} />
        <CapacityBar compact label="Vehicles" used={v.used.VEHICLE} capacity={v.capacities.VEHICLE} />
        <CapacityBar compact label="Cargo" used={v.used.CARGO} capacity={v.capacities.CARGO} />
      </div>
    </Link>
  );
}
