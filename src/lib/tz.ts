/** Offset of `timeZone` from UTC at `at`, in milliseconds (positive east of Greenwich). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant today began in `timeZone`. A ferry company in Manila must see "today" as Manila's day
 * whatever time zone the server happens to run in.
 */
export function startOfDayInZone(now: Date, timeZone: string): Date {
  let zone = timeZone;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    zone = "UTC";
  }
  const local = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const n = (type: string) => Number(local.find((p) => p.type === type)?.value);
  const midnightAsUtc = Date.UTC(n("year"), n("month") - 1, n("day"));
  // Offsets can differ either side of a daylight-saving change, so settle on the offset in force at midnight itself.
  let guess = midnightAsUtc - zoneOffsetMs(new Date(midnightAsUtc), zone);
  guess = midnightAsUtc - zoneOffsetMs(new Date(guess), zone);
  return new Date(guess);
}
