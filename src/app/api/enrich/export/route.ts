import { createClient } from "@/utils/supabase/server";
import { getSessionContext } from "@/lib/supabase/queries";
import { CSV_BOM, csvLine } from "@/lib/csv/export";
import { PREB_COLUMNS, rowCells } from "@/lib/lists/export-columns";

export const maxDuration = 60;

const PAGE = 1000;
const INPUT_COLUMNS = ["First name", "Last name", "Company domain", "LinkedIn URL"];

/**
 * CSV export of every manually enriched contact in the workspace (Enrich tab
 * history), newest first. Access is enforced by RLS through the session client.
 */
export async function GET() {
  const session = await getSessionContext();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });

  const supabase = await createClient();
  const encoder = new TextEncoder();
  let cursor = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvLine([...INPUT_COLUMNS, ...PREB_COLUMNS])));
    },
    async pull(controller) {
      const { data, error } = await supabase
        .from("list_contacts")
        .select("*, lists!inner(source)")
        .eq("workspace_id", session.workspace.id)
        .eq("lists.source", "manual")
        .order("created_at", { ascending: false })
        .order("row_index", { ascending: true })
        .range(cursor, cursor + PAGE - 1);
      if (error) {
        controller.error(new Error(error.message));
        return;
      }
      const rows = data ?? [];
      if (rows.length > 0) {
        controller.enqueue(
          encoder.encode(
            rows
              .map((c) => {
                // Typed input, but LinkedIn-only rows get the name we found from the profile.
                const cells = rowCells(c, INPUT_COLUMNS);
                cells[0] = cells[0] || c.first_name || "";
                cells[1] = cells[1] || c.last_name || "";
                return csvLine(cells);
              })
              .join(""),
          ),
        );
      }
      cursor += rows.length;
      if (rows.length < PAGE) controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="preb-enriched-contacts.csv"',
      "cache-control": "private, no-store",
    },
  });
}
