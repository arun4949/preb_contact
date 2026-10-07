/** RFC 4180 CSV writer helpers for the export route (Excel-friendly: BOM + CRLF). */

export const CSV_BOM = "﻿";

export function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = typeof value === "string" ? value : String(value);
  // Neutralise spreadsheet formula injection on cells starting with = + - @.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvLine(cells: unknown[]): string {
  return cells.map(csvCell).join(",") + "\r\n";
}

/** File name safe for Content-Disposition (ASCII, no quotes). */
export function safeFileName(name: string, suffix: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "list"}${suffix}.csv`;
}
