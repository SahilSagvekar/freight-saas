/** Splits a comma/space/semicolon separated list of addresses and keeps the valid, distinct ones (at most 10). */
export function parseEmails(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^\S+@\S+\.\S+$/.test(s)))].slice(0, 10);
}
