/**
 * CSV for accountants. Cells that start with = + - @ are prefixed with an apostrophe so a spreadsheet can't
 * run them as formulas (booking notes and contact names come from the public).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  // The BOM makes Excel read accents and non-Latin names as UTF-8.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
