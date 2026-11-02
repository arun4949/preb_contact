import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { failure, result, toRunSummary } from "../format";
import { withContext } from "../server-context";
import { loadRun, runReport } from "./enrich";

export function registerResultsTools(server: McpServer) {
  server.registerTool(
    "get_enrichment_results",
    {
      title: "Get enrichment results",
      description: "Status and results of one enrichment run (started from this assistant, the Enrich tab or a list upload). Use the run_id from enrich_contacts or list_enrichment_runs. Runs usually finish within one to two minutes.",
      inputSchema: z.object({ run_id: z.string().uuid().describe("The run id") }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withContext(async (ctx, { run_id }) => {
      const run = await loadRun(ctx, run_id);
      if (!run) return failure("No run with this id in the connected workspace.");
      return runReport(run.list, run.contacts, ctx.assistantName);
    }),
  );

  server.registerTool(
    "list_enrichment_runs",
    {
      title: "List recent enrichment runs",
      description: "The most recent enrichment runs in the connected workspace with their status, counts and credits used, newest first. Includes list uploads, Enrich tab runs and runs started from an assistant.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional().describe("How many runs, default 10") }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withContext(async (ctx, { limit }) => {
      const { data } = await ctx.admin
        .from("lists")
        .select("*")
        .eq("workspace_id", ctx.workspace.id)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(limit ?? 10);
      const runs = (data ?? []).map(toRunSummary);
      if (runs.length === 0) return result("No enrichment runs yet in this workspace.", { runs: [] });
      const lines = runs.map((r) => `- **${r.name}** (${r.status_label}): ${r.processed_contacts}/${r.total_contacts} people, ${r.found_work_emails} work emails, ${r.found_personal_emails} personal emails, ${r.found_phones} mobiles, ${r.credits_used} credits. run_id ${r.run_id}, ${r.url}`);
      return result(`Recent runs in "${ctx.workspace.name}":\n\n${lines.join("\n")}`, { runs });
    }),
  );
}
