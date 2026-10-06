// Money is stored as integers in minor units (cents) alongside a currency code, never as floats.

export function minorUnitDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatMoney(minor: number, currency: string, locale = "en"): string {
  const digits = minorUnitDigits(currency);
  const value = minor / 10 ** digits;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(digits)}`;
  }
}

/** Parses user input like "12.50" into minor units. Returns null if it is not a valid amount. */
export function toMinor(input: string | number, currency: string): number | null {
  const digits = minorUnitDigits(currency);
  const text = String(input).trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10 ** digits);
}

/** Minor units back to a plain decimal string for form fields, e.g. 1250 -> "12.50". */
export function fromMinor(minor: number, currency: string): string {
  const digits = minorUnitDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}
