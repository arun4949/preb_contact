import "server-only";

import { createClient } from "@/utils/supabase/server";
import type { ListRow } from "@/lib/supabase/queries";
import { EMPTY_MAPPING } from "@/lib/csv/automap";
import { PROCESSED_STATUSES, RISKY_STATUSES, VALID_STATUSES, type ContactRow, type Segment } from "./segments";
import { SORT_COLUMNS, type ContactQuery } from "./contact-query";

export type { ContactQuery, ContactSort, PageSize, PhoneFilter } from "./contact-query";
export { PAGE_SIZES, DEFAULT_CONTACT_QUERY, parseContactQuery } from "./contact-query";

type Builder = ReturnType<ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>["select"]>;

/** Applies a download/filter segment to a `list_contacts` query. */
export function applySegment<T extends { in: Builder["in"]; is: Builder["is"]; not: Builder["not"] }>(query: T, segment: Segment): T {
  switch (segment) {
    case "valid":
      return query.in("work_email_status", [...VALID_STATUSES]).not("work_email", "is", null) as T;
    case "risky":
      return query.in("work_email_status", [...RISKY_STATUSES]).not("work_email", "is", null) as T;
    case "not_found":
      return query.in("status", [...PROCESSED_STATUSES]).is("work_email", null) as T;
    default:
      return query;
  }
}

const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&").replace(/[,()]/g, " ");

export interface ContactsPage {
  rows: ContactRow[];
  total: number;
  totalPages: number;
}

/** One server-side page of contacts for the detail table (RLS-scoped). */
export async function getListContacts(listId: string, query: ContactQuery): Promise<ContactsPage> {
  const supabase = await createClient();
  let q = supabase.from("list_contacts").select("*", { count: "exact" }).eq("list_id", listId);
  q = applySegment(q, query.email);
  if (query.phone === "found") q = q.not("phone", "is", null);
  else if (query.phone === "not_found") q = q.is("phone", null);
  const term = query.q.trim();
  if (term) {
    const like = `%${escapeLike(term)}%`;
    q = q.or(
      ["full_name", "first_name", "last_name", "company", "company_name", "company_domain", "job_title", "work_email", "personal_email", "location"]
        .map((c) => `${c}.ilike.${like}`)
        .join(","),
    );
  }
  const from = (query.page - 1) * query.pageSize;
  const column = SORT_COLUMNS[query.sort];
  q = q.order(column, { ascending: query.dir === "asc", nullsFirst: false });
  if (query.sort === "name") q = q.order("last_name", { ascending: query.dir === "asc", nullsFirst: false });
  if (query.sort !== "row") q = q.order("row_index", { ascending: true });
  const { data, count } = await q.range(from, from + query.pageSize - 1);
  const total = count ?? 0;
  return { rows: data ?? [], total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

/** Spreadsheet columns that were not mapped to a Preb field (pass-through columns). */
export function extraColumns(list: Pick<ListRow, "column_mapping">): string[] {
  const mapping = (list.column_mapping ?? {}) as Record<string, unknown>;
  const headers = Array.isArray(mapping.headers) ? (mapping.headers as unknown[]).map((h, i) => (typeof h === "string" && h ? h : `Column ${i + 1}`)) : [];
  const mapped = new Set<number>();
  for (const key of Object.keys(EMPTY_MAPPING)) {
    const idx = mapping[key];
    if (typeof idx === "number") mapped.add(idx);
  }
  return headers.filter((_, i) => !mapped.has(i));
}

/** All original headers in file order (export keeps them first). */
export function originalColumns(list: Pick<ListRow, "column_mapping">): string[] {
  const mapping = (list.column_mapping ?? {}) as Record<string, unknown>;
  return Array.isArray(mapping.headers) ? (mapping.headers as unknown[]).map((h, i) => (typeof h === "string" && h ? h : `Column ${i + 1}`)) : [];
}

export interface ListEta {
  /** Seconds left, or null when there is no signal yet. */
  seconds: number | null;
  /** Rows per minute observed so far. */
  rowsPerMinute: number | null;
}

/** ETA from the list's observed throughput (settled batches, else elapsed time). */
export async function getListEta(list: ListRow): Promise<ListEta> {
  const target = list.row_limit ? Math.min(list.row_limit, list.enrichable_rows) : list.enrichable_rows;
  const remaining = Math.max(0, target - list.processed_rows);
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("enrichment_batches")
    .select("contact_count, submitted_at, settled_at")
    .eq("list_id", list.id)
    .not("settled_at", "is", null)
    .neq("provider", "cache")
    .limit(50);
  let contacts = 0;
  let seconds = 0;
  for (const b of batches ?? []) {
    const s = (new Date(b.settled_at!).getTime() - new Date(b.submitted_at).getTime()) / 1000;
    if (s > 0) {
      contacts += b.contact_count;
      seconds += s;
    }
  }
  let perMinute: number | null = null;
  if (contacts > 0 && seconds > 0) perMinute = (contacts / seconds) * 60;
  else if (list.started_at && list.processed_rows > 0) {
    const elapsed = (Date.now() - new Date(list.started_at).getTime()) / 1000;
    if (elapsed > 30) perMinute = (list.processed_rows / elapsed) * 60;
  }
  if (!perMinute || perMinute <= 0) return { seconds: null, rowsPerMinute: null };
  // The dispatcher submits in parallel batches, so cap optimism at the batch size.
  return { seconds: Math.round((remaining / perMinute) * 60), rowsPerMinute: Math.round(perMinute) };
}
