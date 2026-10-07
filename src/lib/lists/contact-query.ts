import type { Segment } from "./segments";

/** Pure (client-safe) table query types + URL parser. Server queries live in `queries.ts`. */
export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export type ContactSort = "row" | "name" | "job_title" | "company" | "location" | "work_email" | "phone";
export type PhoneFilter = "found" | "not_found";

export interface ContactQuery {
  page: number;
  pageSize: PageSize;
  sort: ContactSort;
  dir: "asc" | "desc";
  q: string;
  email: Segment;
  phone: PhoneFilter | null;
}

export const DEFAULT_CONTACT_QUERY: ContactQuery = { page: 1, pageSize: 25, sort: "row", dir: "asc", q: "", email: "all", phone: null };

export const SORT_COLUMNS: Record<ContactSort, string> = {
  row: "row_index",
  name: "first_name",
  job_title: "job_title",
  company: "company",
  location: "location",
  work_email: "work_email",
  phone: "phone",
};

/** Parses `?page=…&size=…&sort=…&dir=…&q=…&email=…&phone=…` into a safe query. */
export function parseContactQuery(params: Record<string, string | string[] | undefined>): ContactQuery {
  const pick = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const page = Math.max(1, parseInt(pick("page"), 10) || 1);
  const sizeRaw = parseInt(pick("size"), 10);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeRaw) ? (sizeRaw as PageSize) : 25;
  const sortRaw = pick("sort");
  const sort = (Object.keys(SORT_COLUMNS) as ContactSort[]).includes(sortRaw as ContactSort) ? (sortRaw as ContactSort) : "row";
  const dir = pick("dir") === "desc" ? "desc" : "asc";
  const q = pick("q").slice(0, 120);
  const emailRaw = pick("email");
  const email: Segment = emailRaw === "valid" || emailRaw === "risky" || emailRaw === "not_found" ? emailRaw : "all";
  const phoneRaw = pick("phone");
  const phone: PhoneFilter | null = phoneRaw === "found" || phoneRaw === "not_found" ? phoneRaw : null;
  return { page, pageSize, sort, dir, q, email, phone };
}

