import type { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { exportListCsv } from "@/lib/lists/export-stream";
import { parseSegment } from "@/lib/lists/segments";

export const maxDuration = 60;

/**
 * CSV export of a list for signed-in members. `?segment=all|valid|catch_all|not_found` (`risky` is kept as an alias of `catch_all`).
 * Access is enforced by RLS through the session client; the streaming body
 * lives in `exportListCsv` (shared with the public lead share export).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const segment = parseSegment(request.nextUrl.searchParams.get("segment") ?? "all");
  if (!segment) return Response.json({ error: "Unknown segment" }, { status: 400 });

  const supabase = await createClient();
  const { data: list } = await supabase.from("lists").select("id, name, status, column_mapping").eq("id", id).maybeSingle();
  if (!list) return Response.json({ error: "Not found" }, { status: 404 });
  if (list.status === "draft") return Response.json({ error: "This list has not been started" }, { status: 409 });

  return exportListCsv(supabase, list, segment);
}
