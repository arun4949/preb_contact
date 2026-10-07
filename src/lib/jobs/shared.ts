import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";

export type Admin = SupabaseClient<Database>;
export type ListRow = Tables<"lists">;
export type BatchRow = Tables<"enrichment_batches">;
export type ContactRow = Tables<"list_contacts">;

export const PROVIDER = "fullenrich";
/** Batches served from our own cache (cross-workspace hits, charged normally). */
export const CACHE_PROVIDER = "cache";
export const CACHE_TTL_DAYS = 90;
export const BATCH_SIZE = 100;

/** Structured log line for the engine — never includes contact PII. */
export function log(event: string, fields: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ at: new Date().toISOString(), scope: "engine", event, ...fields }));
}

export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ at: new Date().toISOString(), scope: "engine", event, error: message, ...fields }));
}

export function appOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return origin.replace(/\/$/, "");
}

export function webhookUrl(): string {
  return `${appOrigin()}/api/webhooks/${PROVIDER}`;
}

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Release every open hold of a list (list reached a terminal state). */
export async function releaseHolds(admin: Admin, listId: string) {
  await admin.from("credit_holds").update({ released_at: new Date().toISOString() }).eq("list_id", listId).is("released_at", null);
}

/** Sum of the list's own open holds — the list may spend what it reserved. */
export async function ownHold(admin: Admin, listId: string): Promise<number> {
  const { data } = await admin.from("credit_holds").select("amount").eq("list_id", listId).is("released_at", null);
  return (data ?? []).reduce((sum, h) => sum + h.amount, 0);
}

/** Credits the list may still spend: workspace availability plus its own reservation. */
export async function spendableCredits(admin: Admin, list: Pick<ListRow, "id" | "workspace_id">): Promise<number> {
  const [{ data: available }, hold] = await Promise.all([
    admin.rpc("credits_available", { ws: list.workspace_id }),
    ownHold(admin, list.id),
  ]);
  return (available ?? 0) + hold;
}

export async function countContacts(
  admin: Admin,
  listId: string,
  status: Database["public"]["Enums"]["contact_status"] | Database["public"]["Enums"]["contact_status"][],
): Promise<number> {
  let q = admin.from("list_contacts").select("id", { count: "exact", head: true }).eq("list_id", listId);
  q = Array.isArray(status) ? q.in("status", status) : q.eq("status", status);
  const { count } = await q;
  return count ?? 0;
}

/** Rows that were sent to the provider (or served from cache) — what `row_limit` counts. */
export async function countUpstreamRows(admin: Admin, listId: string): Promise<number> {
  const { count } = await admin.from("list_contacts").select("id", { count: "exact", head: true }).eq("list_id", listId).not("batch_id", "is", null);
  return count ?? 0;
}

/** Put claimed contacts back when the provider rejected the batch. */
export async function revertBatchContacts(admin: Admin, batchId: string) {
  await admin.from("list_contacts").update({ status: "pending", batch_id: null }).eq("batch_id", batchId).eq("status", "submitted");
}
