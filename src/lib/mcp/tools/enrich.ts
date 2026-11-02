import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Json } from "@/lib/supabase/types";
import { insertContacts, queueList } from "@/lib/lists/insert-contacts";
import { manualListName } from "@/lib/lists/manual";
import { MCP_DEFAULT_WAIT_SECONDS, MCP_MAX_WAIT_SECONDS, MCP_RUNS_PER_MINUTE } from "../config";
import { contactsInputSchema, fieldsInputSchema, fieldsText, MCP_HEADERS, MCP_MAPPING, normaliseContacts } from "../contacts";
import type { McpContext } from "../context";
import { contactsTable, failure, pauseAdvice, result, runUrl, TERMINAL_STATUSES, toContactResult, toRunSummary, WAITING_STATUSES, type ListRow } from "../format";
import { withContext } from "../server-context";

const POLL_MS = 2500;

/** The run with its contacts, scoped to the workspace (service role, so the scope check is explicit). */
export async function loadRun(ctx: McpContext, runId: string) {
  const { data: list } = await ctx.admin.from("lists").select("*").eq("id", runId).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!list) return null;
  const { data: contacts } = await ctx.admin.from("list_contacts").select("*").eq("list_id", list.id).order("row_index", { ascending: true }).limit(1000);
  return { list, contacts: contacts ?? [] };
}

export function runReport(list: ListRow, contacts: Parameters<typeof toContactResult>[0][], assistantName: string) {
  const rows = contacts.map(toContactResult);
  const done = TERMINAL_STATUSES.has(list.status);
  const waiting = WAITING_STATUSES.has(list.status);
  const summary = toRunSummary(list);
  const found = rows.filter((r) => r.work_email || r.personal_email || r.phone).length;
  const pending = rows.filter((r) => r.status === "in progress").length;
  const lines: string[] = [];
  if (done) lines.push(`**Run "${list.name}" is finished**: ${found} of ${rows.length} people got at least one result, ${list.credits_used.toLocaleString("en-US")} credits used.`);
  else if (waiting) lines.push(`**Run "${list.name}" is waiting** (${summary.status_label}). ${pauseAdvice(list) ?? ""}`.trim());
  else lines.push(`**Run "${list.name}" is still running**: ${rows.length - pending} of ${rows.length} people done so far. Results usually take one to two minutes. Call get_enrichment_results with run_id ${list.id} in about 30 seconds for the rest.`);
  lines.push(contactsTable(rows));
  lines.push(`The results are also in Preb: ${runUrl(list)} (started from ${list.source === "mcp" ? assistantName : summary.started_from}).`);
  return result(lines.join("\n\n"), { run: summary, finished: done, waiting, contacts: rows });
}

export function registerEnrichTool(server: McpServer) {
  server.registerTool(
    "enrich_contacts",
    {
      title: "Enrich contacts",
      description:
        "Find verified work emails, personal emails and mobile numbers for up to 100 people, from a LinkedIn URL or a name plus company, or identify the person behind an email address. This spends the workspace's credits (only for results found). Call estimate_enrichment first and get the user's confirmation. The tool waits up to wait_seconds for results and returns what is ready; call get_enrichment_results with the run_id for the rest. The run also appears in the Enrich tab of the Preb app.",
      inputSchema: z.object({
        contacts: contactsInputSchema,
        fields: fieldsInputSchema,
        wait_seconds: z.number().int().min(0).max(MCP_MAX_WAIT_SECONDS).optional().describe(`How long to wait for results before answering (default ${MCP_DEFAULT_WAIT_SECONDS}, max ${MCP_MAX_WAIT_SECONDS}). Use 0 to start the run and return at once.`),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withContext(async (ctx, { contacts, fields, wait_seconds }) => {
      const { rows, summary } = normaliseContacts(contacts);
      if (summary.enrichable === 0 && summary.emailOnly === 0) {
        return failure("None of these people can be enriched. Each person needs a LinkedIn URL, or a first name, last name and company (domain or name), or an email address to identify them.");
      }

      // Abuse guard: a runaway assistant cannot start runs in a loop.
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count: recent } = await ctx.admin.from("lists").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).eq("created_by", ctx.userId).eq("source", "mcp").gte("created_at", since);
      if ((recent ?? 0) >= MCP_RUNS_PER_MINUTE) return failure(`Too many runs started in the last minute (limit ${MCP_RUNS_PER_MINUTE}). Wait a moment and try again, or combine the people into one run.`);

      const name = manualListName(rows);
      const { data: list, error: insErr } = await ctx.admin
        .from("lists")
        .insert({
          workspace_id: ctx.workspace.id,
          created_by: ctx.userId,
          name,
          status: "draft",
          source: "mcp",
          source_detail: ctx.assistantName,
          column_mapping: { ...MCP_MAPPING, headers: [...MCP_HEADERS] } as Json,
          has_header: true,
          duplicates_removed: summary.duplicates,
        })
        .select("*")
        .single();
      if (insErr || !list) return failure("Preb could not start the run. Please try again.");

      const fail = async (message: string) => {
        await ctx.admin.from("lists").delete().eq("id", list.id);
        return failure(message);
      };
      const inserted = await insertContacts(ctx.admin, ctx.workspace.id, list.id, rows);
      if (!inserted.ok) return fail(inserted.error);

      const queued = await queueList({ client: ctx.admin, workspaceId: ctx.workspace.id, list, input: { name, fields, rowLimit: null, reverseLookup: summary.emailOnly > 0 } });
      if (queued) {
        return fail(
          queued.shortBy
            ? `${queued.error} The workspace is short by about ${queued.shortBy.toLocaleString("en-US")} credits. Ask the user to add credits or turn on overspend in Preb (Settings > Billing), then try again.`
            : queued.error,
        );
      }

      const wait = Math.min(MCP_MAX_WAIT_SECONDS, Math.max(0, wait_seconds ?? MCP_DEFAULT_WAIT_SECONDS));
      const deadline = Date.now() + wait * 1000;
      let run = await loadRun(ctx, list.id);
      while (run && !TERMINAL_STATUSES.has(run.list.status) && !WAITING_STATUSES.has(run.list.status) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, Math.min(POLL_MS, Math.max(250, deadline - Date.now()))));
        run = await loadRun(ctx, list.id);
      }
      if (!run) return failure("The run disappeared while it was starting. Please try again.");
      const report = runReport(run.list, run.contacts, ctx.assistantName);
      const intro = `Started a run to find ${fieldsText(fields)} for ${summary.enrichable + summary.emailOnly} people.`;
      return { ...report, content: [{ type: "text", text: `${intro}\n\n${report.content[0].type === "text" ? report.content[0].text : ""}` }] };
    }),
  );
}
