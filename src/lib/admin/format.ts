/**
 * Display formatting for the admin account pages (client-safe). Dates are
 * formatted on the server and passed down as strings, so a table rendered in
 * a client component never differs between server and browser time zones.
 */
export const n = (value: number) => value.toLocaleString("en-US");

/** "Nov 17, 02:41 AM" */
export const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** "Nov 17, 2026" */
export const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Whole percent of `part` in `total`, null when there is nothing to divide by. */
export function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

export const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`;

/** "26–50 of 120" for a table footer; a single row reads "16 of 16". */
export function rowRange(page: number, pageSize: number, rows: number, total: number): string {
  const first = (page - 1) * pageSize + 1;
  const last = first + rows - 1;
  return `${first === last ? n(last) : `${n(first)}–${n(last)}`} of ${n(total)}`;
}
