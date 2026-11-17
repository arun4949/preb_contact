/**
 * URL state of the admin account pages. Everything a filter, sort or pager
 * changes lives in the query string, so reload and back keep the view. Unknown
 * values fall back to the default instead of reaching the database.
 */
export const ACCOUNT_FILTERS = ["all", "onboarded", "paying", "trial", "spend"] as const;
export type AccountFilter = (typeof ACCOUNT_FILTERS)[number];

export const ACCOUNT_SORTS = ["created", "last_sign_in", "spent", "available", "lists"] as const;
export type AccountSort = (typeof ACCOUNT_SORTS)[number];

export type SortDir = "asc" | "desc";

export const ACCOUNTS_PAGE_SIZE = 25;
export const DETAIL_PAGE_SIZE = 25;

export interface AccountsParams {
  q: string;
  filter: AccountFilter;
  sort: AccountSort;
  dir: SortDir;
  page: number;
}

export const ACCOUNT_TABS = ["lists", "credits", "billing", "workspace", "activity"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

export const LIST_SOURCE_FILTERS = ["all", "csv", "manual", "mcp"] as const;
export type ListSourceFilter = (typeof LIST_SOURCE_FILTERS)[number];

export const LIST_STATUS_FILTERS = ["all", "running", "finished", "attention", "draft"] as const;
export type ListStatusFilter = (typeof LIST_STATUS_FILTERS)[number];

export interface AccountDetailParams {
  tab: AccountTab;
  /** Requested workspace; the page checks it against the person's memberships. */
  ws: string | null;
  listsPage: number;
  ledgerPage: number;
  source: ListSourceFilter;
  status: ListStatusFilter;
}

type Raw = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function first(raw: Raw, key: string): string {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** 1-based page number; anything that is not a positive whole number is page 1. */
function pageOf(value: string): number {
  if (!/^\d{1,6}$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

export function parseAccountsParams(raw: Raw): AccountsParams {
  return {
    q: first(raw, "q").trim().slice(0, 100),
    filter: oneOf(first(raw, "filter"), ACCOUNT_FILTERS, "all"),
    sort: oneOf(first(raw, "sort"), ACCOUNT_SORTS, "created"),
    dir: first(raw, "dir") === "asc" ? "asc" : "desc",
    page: pageOf(first(raw, "page")),
  };
}

export function parseAccountDetailParams(raw: Raw): AccountDetailParams {
  const ws = first(raw, "ws");
  return {
    tab: oneOf(first(raw, "tab"), ACCOUNT_TABS, "lists"),
    ws: isUuid(ws) ? ws : null,
    listsPage: pageOf(first(raw, "lists")),
    ledgerPage: pageOf(first(raw, "ledger")),
    source: oneOf(first(raw, "source"), LIST_SOURCE_FILTERS, "all"),
    status: oneOf(first(raw, "status"), LIST_STATUS_FILTERS, "all"),
  };
}

/** Pages needed for `total` rows, never less than one. */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
