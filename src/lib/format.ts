import { format, isToday, isTomorrow } from "date-fns";

export function formatDeparture(date: Date) {
  const time = format(date, "h:mm a");
  if (isToday(date)) return `Today, ${time}`;
  if (isTomorrow(date)) return `Tomorrow, ${time}`;
  return `${format(date, "EEE d MMM")}, ${time}`;
}
export const formatDate = (date: Date) => format(date, "d MMM yyyy");
export const formatDateTime = (date: Date) => format(date, "d MMM yyyy, h:mm a");
export const KIND_LABEL = { PASSENGER: "Passengers", VEHICLE: "Vehicles", CARGO: "Cargo" } as const;
export const bookingLabel = (prefix: string, n: number) => `${prefix}${String(n).padStart(5, "0")}`;
