import "server-only";

import { CSV_BOM, csvLine, safeFileName } from "@/lib/csv/export";
import { applySegment, originalColumns, type ListsClient } from "@/lib/lists/queries";
import { PREB_COLUMNS, rowCells } from "@/lib/lists/export-columns";
import { SEGMENTS, type Segment } from "@/lib/lists/segments";
import type { ListRow } from "@/lib/supabase/queries";

const PAGE = 1000;

const SEGMENT_SUFFIX: Record<string, string> = { all: "", valid: "-valid-emails", risky: "-risky-emails", not_found: "-not-found" };

/**
 * CSV export of a list: original columns first (file order), then the Preb
 * columns. Streams 1,000 rows at a time. Access is the caller's job: the
 * signed-in route passes the RLS session client, the public lead share route
 * passes the service-role client after checking the access cookie.
 */
export function exportListCsv(client: ListsClient, list: Pick<ListRow, "id" | "name" | "column_mapping">, segment: Segment): Response {
  const headers = originalColumns(list);
  const fileName = safeFileName(list.name, SEGMENT_SUFFIX[segment]);
  const encoder = new TextEncoder();
  let cursor = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvLine([...headers, ...PREB_COLUMNS])));
    },
    async pull(controller) {
      let q = client.from("list_contacts").select("*").eq("list_id", list.id).order("row_index", { ascending: true }).range(cursor, cursor + PAGE - 1);
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
