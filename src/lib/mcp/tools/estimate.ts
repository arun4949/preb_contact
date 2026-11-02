import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { estimateCredits } from "@/lib/credits/estimate";
import { countCacheHits, lookupCache } from "@/lib/lists/insert-contacts";
import { contactsInputSchema, fieldsInputSchema, fieldsText, normaliseContacts, rowLabel, skipText } from "../contacts";
import { result } from "../format";
import { withContext } from "../server-context";

export function registerEstimateTool(server: McpServer) {
  server.registerTool(
    "estimate_enrichment",
    {
      title: "Estimate the cost of an enrichment",
      description:
        "Check a set of people before spending anything: which rows can be enriched, which are free because they were enriched in the last 90 days, and the typical and maximum credits. Call this first, show the user the numbers, and only call enrich_contacts after they confirm.",
      inputSchema: z.object({ contacts: contactsInputSchema, fields: fieldsInputSchema }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withContext(async (ctx, { contacts, fields }) => {
      const { rows, summary } = normaliseContacts(contacts);
      const lookup = await lookupCache(ctx.admin, ctx.workspace.id, rows);
      const { cached, cachedReverse } = countCacheHits(rows, lookup);
      const enrichRows = Math.max(0, summary.enrichable - cached);
      const reverseRows = Math.max(0, summary.emailOnly - cachedReverse);
      const estimate = estimateCredits(enrichRows, fields, reverseRows);
      const { data: available } = await ctx.admin.rpc("credits_available", { ws: ctx.workspace.id });
      const credits = available ?? 0;
      const skipped = rows.filter((r) => !r.enrichable && r.skipReason !== "email_only").map((r) => ({ row: r.rowIndex + 1, label: rowLabel(r), reason: skipText(r) }));

      const lines = [
        `**${summary.enrichable + summary.emailOnly} of ${summary.total} people can be processed** (${summary.enrichable} to enrich${summary.emailOnly ? `, ${summary.emailOnly} identified by email` : ""}${cached + cachedReverse ? `, ${cached + cachedReverse} already enriched in the last 90 days and free` : ""}).`,
        `Finding ${fieldsText(fields)}: **typically about ${estimate.typical.toLocaleString("en-US")} credits, at most ${estimate.max.toLocaleString("en-US")}**. The workspace has ${credits.toLocaleString("en-US")} credits.`,
        credits < estimate.typical ? "That is not enough for the typical cost. Ask the user to add credits or turn on overspend before starting." : "Ask the user to confirm, then call enrich_contacts with the same people and fields.",
      ];
      if (skipped.length) lines.push(`Cannot be processed:\n${skipped.map((s) => `- Row ${s.row} (${s.label}): ${s.reason}`).join("\n")}`);
      return result(lines.join("\n\n"), {
        total: summary.total,
        enrichable: summary.enrichable,
        email_only: summary.emailOnly,
        duplicates: summary.duplicates,
        already_enriched_free: cached + cachedReverse,
        skipped,
        fields,
        credits_typical: estimate.typical,
        credits_max: estimate.max,
        credits_available: credits,
        enough_credits: credits >= estimate.typical,
      });
    }),
  );
}
