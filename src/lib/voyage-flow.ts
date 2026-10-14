import type { VoyageStatus } from "./domain";

/** The moves a voyage can make. Anything not listed here is refused, so a sailed voyage can't be "un-sailed". */
const FLOW: Record<VoyageStatus, { to: VoyageStatus; label: string; danger?: boolean }[]> = {
  SCHEDULED: [
    { to: "BOARDING", label: "Start boarding" },
    { to: "CANCELLED", label: "Cancel voyage", danger: true },
  ],
  BOARDING: [
    { to: "DEPARTED", label: "Mark departed" },
    { to: "SCHEDULED", label: "Back to scheduled" },
    { to: "CANCELLED", label: "Cancel voyage", danger: true },
  ],
  DEPARTED: [{ to: "ARRIVED", label: "Mark arrived" }],
  ARRIVED: [],
  CANCELLED: [],
};

export const voyageMoves = (from: VoyageStatus) => FLOW[from];
export const canMoveVoyage = (from: VoyageStatus, to: VoyageStatus) => FLOW[from].some((m) => m.to === to);
