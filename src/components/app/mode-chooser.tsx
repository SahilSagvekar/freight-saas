"use client";

import { Plane, Ship, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShipmentMode } from "@/lib/shipment";
import { MODE_LABELS } from "@/lib/domain";

const ICONS = { AIR: Plane, OCEAN: Ship, GROUND: Truck } as const satisfies Record<ShipmentMode, unknown>;
/** The order people think of them in. */
const ORDER = ["AIR", "OCEAN", "GROUND"] as const satisfies readonly ShipmentMode[];
const SHORT = { AIR: "Air", OCEAN: "Ocean", GROUND: "Road" } as const satisfies Record<ShipmentMode, string>;

/**
 * Air, ocean or road, with nothing chosen until the person chooses. There is deliberately no default: a quiet default
 * of "ocean" is how an air job ends up on a Bill of Lading. `value` is "" until a mode is picked.
 */
export function ModeChooser({ value, onChange, error, id = "mode" }: { value: string; onChange: (mode: ShipmentMode) => void; error?: string; id?: string }) {
  return (
    <div>
      <div role="radiogroup" aria-label="How is it travelling?" aria-describedby={error ? `${id}-error` : undefined} className="grid grid-cols-3 gap-2 sm:max-w-md">
        {ORDER.map((m) => {
          const Icon = ICONS[m];
          const selected = value === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              title={MODE_LABELS[m]}
              onClick={() => onChange(m)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition-colors motion-reduce:transition-none",
                selected ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line bg-surface text-ink hover:border-brand-300 hover:bg-canvas",
                error && !selected && "border-danger-600",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {SHORT[m]}
            </button>
          );
        })}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger-600">{error}</p>}
    </div>
  );
}
