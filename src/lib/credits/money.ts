/**
 * USD formatting for the English UI (client-safe; no server-only imports).
 * `$36.50`, `$1,437.50`, whole amounts without decimals (`$390`).
 */
const WHOLE = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const CENTS = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FINE = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 3 });

export function formatUsd(cents: number): string {
  return Number.isInteger(cents / 100) ? WHOLE.format(cents / 100) : CENTS.format(cents / 100);
}

/** Always two decimals (`$36.50`, `$390.00`) — invoices and amounts due. */
export function formatUsdExact(cents: number): string {
  return CENTS.format(cents / 100);
}

/** Per-credit / per-item price with up to three decimals (`$0.037`). */
export function formatUsdFine(cents: number): string {
  return FINE.format(cents / 100);
}
