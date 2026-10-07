import Papa from "papaparse";
import * as XLSX from "xlsx";

/** Hard caps from the plan: 10,000 rows, 20 MB. */
export const MAX_ROWS = 10_000;
export const MAX_BYTES = 20 * 1024 * 1024;

export type FileType = "csv" | "xlsx";

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  /** True when the sheet had more than MAX_ROWS rows and was cut. */
  truncated: boolean;
}

export function fileTypeFor(name: string): FileType | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv" || ext === "txt" || ext === "tsv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  return null;
}

/** UTF-8 first (strict), Latin-1 as fallback for legacy exports. */
export function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("iso-8859-1").decode(bytes);
  }
}

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function toSheet(matrix: string[][], hasHeader: boolean, limit?: number): ParsedSheet {
  const rows = matrix.filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
  const headerRow = hasHeader ? rows.shift() ?? [] : [];
  const width = Math.max(headerRow.length, ...rows.map((r) => r.length), 0);
  const headers = Array.from({ length: width }, (_, i) =>
    hasHeader ? String(headerRow[i] ?? "").trim() || `Column ${i + 1}` : `Column ${i + 1}`,
  );
  const cap = limit ?? MAX_ROWS;
  const truncated = rows.length > cap;
  const body = rows.slice(0, cap).map((r) => Array.from({ length: width }, (_, i) => (r[i] == null ? "" : String(r[i]).trim())));
  return { headers, rows: body, truncated };
}

export function parseCsv(bytes: ArrayBuffer, hasHeader = true, limit?: number): ParsedSheet {
  const text = stripBom(decodeText(bytes));
  const result = Papa.parse<string[]>(text, {
    delimiter: "", // auto-detect , ; \t |
    delimitersToGuess: [",", ";", "\t", "|"],
    skipEmptyLines: "greedy",
    // Keep a small overhead above the cap so `truncated` can be detected.
    preview: limit ? limit + (hasHeader ? 2 : 1) : MAX_ROWS + 2,
  });
  return toSheet(result.data as string[][], hasHeader, limit);
}

export function parseXlsx(bytes: ArrayBuffer, hasHeader = true, limit?: number): ParsedSheet {
  const wb = XLSX.read(bytes, { type: "array", cellDates: false, sheetRows: (limit ?? MAX_ROWS) + 2 });
  const first = wb.SheetNames[0];
  if (!first) return { headers: [], rows: [], truncated: false };
  const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[first], { header: 1, raw: false, defval: "", blankrows: false });
  return toSheet(matrix, hasHeader, limit);
}

export function parseSpreadsheet(type: FileType, bytes: ArrayBuffer, hasHeader = true, limit?: number): ParsedSheet {
  return type === "xlsx" ? parseXlsx(bytes, hasHeader, limit) : parseCsv(bytes, hasHeader, limit);
}
