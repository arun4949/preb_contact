import "server-only";

import { createClient } from "@/utils/supabase/server";
import type { ContactRow } from "@/lib/lists/segments";

export const HISTORY_PAGE_SIZE = 25;

export interface ManualHistory {
  rows: ContactRow[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ManualRunState {
  /** A manual run is queued, enriching or stopping: the page keeps refreshing. */
  running: boolean;
  /** A manual run waits for credits. */
  paused: boolean;
}

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

/** Every contact from manual runs in the workspace, newest first. RLS limits this to members. */
export async function getManualContacts(workspaceId: string, opts: { page?: number; q?: string } = {}): Promise<ManualHistory> {
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  let query = supabase
    .from("list_contacts")
    .select("*, lists!inner(source)", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("lists.source", "manual")
    .order("created_at", { ascending: false })
    .order("row_index", { ascending: true })
    .range(from, from + HISTORY_PAGE_SIZE - 1);
  const q = opts.q?.trim();
  if (q) {
    const term = `%${escapeLike(q)}%`;
    query = query.or(
      ["full_name", "first_name", "last_name", "company_name", "domain", "company", "work_email", "personal_email", "linkedin_url"]
        .map((col) => `${col}.ilike.${term}`)
        .join(","),
    );
  }
  const { data, count } = await query;
  const total = count ?? 0;
  // Drop the joined `lists` column so rows match `ContactRow`.
  const rows = (data ?? []).map((r) => {
    const { lists, ...row } = r;
    void lists;
    return row as ContactRow;
  });
  return { rows, total, page, totalPages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)) };
}

export async function getManualRunState(workspaceId: string): Promise<ManualRunState> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lists")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("source", "manual")
    .in("status", ["queued", "enriching", "stopping", "paused_credits", "paused_upstream"]);
  const statuses = new Set((data ?? []).map((l) => l.status));
  return {
    running: statuses.has("queued") || statuses.has("enriching") || statuses.has("stopping") || statuses.has("paused_upstream"),
    paused: statuses.has("paused_credits"),
  };
}
