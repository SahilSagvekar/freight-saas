export type CapacityVerdict = "OK" | "OVERSELL" | "FULL";

/** Spare units beyond physical capacity that offline-synced bookings may use before needing review. */
export function oversellAllowance(capacity: number, percent: number): number {
  if (capacity <= 0 || percent <= 0) return 0;
  return Math.ceil((capacity * percent) / 100);
}

/**
 * Decides whether a request fits.
 *  - OK:       fits within real capacity.
 *  - OVERSELL: over capacity but inside the allowance (used only for offline-synced bookings).
 *  - FULL:     does not fit.
 */
export function checkCapacity(input: {
  capacity: number;
  used: number;
  requested: number;
  allowance: number;
}): { verdict: CapacityVerdict; remaining: number } {
  const after = input.used + input.requested;
  const remaining = input.capacity - input.used;
  if (after <= input.capacity) return { verdict: "OK", remaining };
  if (after <= input.capacity + input.allowance) return { verdict: "OVERSELL", remaining };
  return { verdict: "FULL", remaining };
}
