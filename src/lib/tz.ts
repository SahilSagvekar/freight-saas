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

function validZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** The instant the calendar day y-m-d began in `timeZone`. */
export function startOfLocalDate(y: number, m: number, d: number, timeZone: string): Date {
  const zone = validZone(timeZone);
  const midnightAsUtc = Date.UTC(y, m - 1, d);
  // Offsets can differ either side of a daylight-saving change, so settle on the offset in force at midnight itself.
  let guess = midnightAsUtc - zoneOffsetMs(new Date(midnightAsUtc), zone);
  guess = midnightAsUtc - zoneOffsetMs(new Date(guess), zone);
  return new Date(guess);
}

/** Today's date in `timeZone` as YYYY-MM-DD. */
export function localDateString(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: validZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

/**
 * The instant today began in `timeZone`. A ferry company in Manila must see "today" as Manila's day
 * whatever time zone the server happens to run in.
 */
export function startOfDayInZone(now: Date, timeZone: string): Date {
  const [y, m, d] = localDateString(now, timeZone).split("-").map(Number) as [number, number, number];
  return startOfLocalDate(y, m, d, timeZone);
}

/** [start, end) of the calendar day `ymd` (YYYY-MM-DD) in `timeZone`; null if `ymd` isn't a real date. */
export function dayRange(ymd: string, timeZone: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { start: startOfLocalDate(y, m, d, timeZone), end: startOfLocalDate(y, m, d + 1, timeZone) };
}

/** "Wed 14 Oct, 7:30 am" in the operator's own time zone and language. */
export function formatInZone(date: Date, timeZone: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: validZone(timeZone), weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}
