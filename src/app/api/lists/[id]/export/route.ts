import type { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { CSV_BOM, csvLine, safeFileName } from "@/lib/csv/export";
import { uiEmailStatus } from "@/lib/fullenrich/mapping";
import type { EmailStatus, EnrichedPhone } from "@/lib/fullenrich/types";
import { applySegment, originalColumns } from "@/lib/lists/queries";
import { contactUiStatus, isSegment, SEGMENTS, type ContactRow } from "@/lib/lists/segments";

export const maxDuration = 60;

const PAGE = 1000;

const APPENDED = [
  "Preb: Work email",
  "Preb: Work email status",
  "Preb: Personal email",
  "Preb: Personal email status",
  "Preb: Phone",
  "Preb: Phone type",
  "Preb: Job title",
  "Preb: Company",
  "Preb: Company domain",
  "Preb: Location",
  "Preb: LinkedIn URL",
  "Preb: Status",
  "Preb: Credits",
] as const;

const SEGMENT_SUFFIX: Record<string, string> = { all: "", valid: "-valid-emails", risky: "-risky-emails", not_found: "-not-found" };

function emailStatusLabel(status: string | null): string {
  if (!status) return "";
  const ui = uiEmailStatus(status as EmailStatus);
  return ui === "valid" ? "Valid" : ui === "risky" ? "Risky (catch-all)" : "Not found";
}

function phoneType(meta: ContactRow["phone_meta"]): string {
  const type = (meta as EnrichedPhone | null)?.line_type;
  if (!type) return "";
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function statusLabel(c: ContactRow): string {
  const s = contactUiStatus(c);
  switch (s.kind) {
    case "enriched":
      return "Enriched";
    case "cached":
      return "Already enriched";
    case "not_found":
      return "Not found";
    case "pending":
      return "Pending";
    case "skipped":
      return `Skipped: ${s.reason}`;
  }
}

function rowCells(c: ContactRow, headers: string[]): unknown[] {
  const raw = (c.raw ?? {}) as Record<string, unknown>;
  const original = headers.map((h) => raw[h] ?? "");
  return [
    ...original,
    c.work_email ?? "",
    emailStatusLabel(c.work_email ? c.work_email_status : null),
    c.personal_email ?? "",
    emailStatusLabel(c.personal_email ? c.personal_email_status : null),
    c.phone ?? "",
    phoneType(c.phone_meta),
    c.job_title ?? "",
    c.company ?? c.company_name ?? "",
    c.company_domain ?? c.domain ?? "",
    c.location ?? "",
    c.linkedin_url ?? "",
    statusLabel(c),
    c.credits_cost,
  ];
}

/**
 * CSV export of a list: original columns first (file order), then the Preb
 * columns. `?segment=all|valid|risky|not_found`. Streams 1,000 rows at a time.
 * Access is enforced by RLS through the session client.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const segmentParam = request.nextUrl.searchParams.get("segment") ?? "all";
  if (!isSegment(segmentParam)) return Response.json({ error: "Unknown segment" }, { status: 400 });
  const segment = segmentParam;

  const supabase = await createClient();
  const { data: list } = await supabase.from("lists").select("id, name, status, column_mapping").eq("id", id).maybeSingle();
  if (!list) return Response.json({ error: "Not found" }, { status: 404 });
  if (list.status === "draft") return Response.json({ error: "This list has not been started" }, { status: 409 });

  const headers = originalColumns(list);
  const fileName = safeFileName(list.name, SEGMENT_SUFFIX[segment]);
  const encoder = new TextEncoder();
  let cursor = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvLine([...headers, ...APPENDED])));
    },
    async pull(controller) {
      let q = supabase.from("list_contacts").select("*").eq("list_id", id).order("row_index", { ascending: true }).range(cursor, cursor + PAGE - 1);
      q = applySegment(q, segment);
      const { data, error } = await q;
      if (error) {
        controller.error(new Error(error.message));
        return;
      }
      const rows = data ?? [];
      if (rows.length > 0) {
        controller.enqueue(encoder.encode(rows.map((c) => csvLine(rowCells(c, headers))).join("")));
      }
      cursor += rows.length;
      if (rows.length < PAGE) controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "private, no-store",
      "x-preb-segment": SEGMENTS.find((s) => s.id === segment)?.label ?? segment,
    },
  });
}
