import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { appOrigin } from "@/lib/jobs/shared";
import { contactName, failure, toContactResult } from "../format";
import { withContext } from "../server-context";

/**
 * ChatGPT's compatibility tools (`search` and `fetch`) over the contacts the
 * workspace has already enriched. ChatGPT plans without full custom-tool
 * access still expose these two, so a user can at least look people up.
 */

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

function contactUrl(listId: string, source: string, contactId: string): string {
  const origin = appOrigin();
  return source === "csv" ? `${origin}/lists/${listId}#${contactId}` : `${origin}/enrich?q=${encodeURIComponent(contactId)}`;
}

export function registerSearchTools(server: McpServer) {
  server.registerTool(
    "search",
    {
      title: "Search enriched contacts",
      description: "Search the people already enriched in the connected Preb workspace by name, company, domain, email or LinkedIn URL. Returns matches to pass to fetch. Does not spend credits and does not look up new people (use enrich_contacts for that).",
      inputSchema: z.object({ query: z.string().trim().min(1).max(200).describe("Name, company, domain, email or LinkedIn URL") }),
      outputSchema: z.object({ results: z.array(z.object({ id: z.string(), title: z.string(), url: z.string() })) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withContext(async (ctx, { query }) => {
      const like = `%${escapeLike(query)}%`;
      const { data } = await ctx.admin
        .from("list_contacts")
        .select("id, list_id, full_name, first_name, last_name, company, company_name, domain, work_email, personal_email, linkedin_url, email_input, job_title, lists!inner(source)")
        .eq("workspace_id", ctx.workspace.id)
        .or(["full_name", "first_name", "last_name", "company", "company_name", "domain", "company_domain", "work_email", "personal_email", "linkedin_url", "email_input"].map((c) => `${c}.ilike.${like}`).join(","))
        .order("created_at", { ascending: false })
        .limit(20);
      const results = (data ?? []).map((c) => ({
        id: c.id,
        title: [contactName(c) ?? "Unknown", c.job_title, c.company ?? c.company_name].filter(Boolean).join(", "),
        url: contactUrl(c.list_id, (c.lists as { source: string }).source, c.id),
      }));
      const structured = { results };
      return { content: [{ type: "text", text: JSON.stringify(structured) }], structuredContent: structured };
    }),
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch one enriched contact",
      description: "Everything Preb found for one contact, by the id returned from search or from a run's results.",
      inputSchema: z.object({ id: z.string().uuid().describe("Contact id") }),
      outputSchema: z.object({ id: z.string(), title: z.string(), text: z.string(), url: z.string(), metadata: z.record(z.string(), z.unknown()).optional() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withContext(async (ctx, { id }) => {
      const { data: c } = await ctx.admin.from("list_contacts").select("*, lists!inner(source)").eq("id", id).eq("workspace_id", ctx.workspace.id).maybeSingle();
      if (!c) return failure("No contact with this id in the connected workspace.");
      const { lists, ...row } = c;
      const r = toContactResult(row);
      const lines = [
        `Name: ${r.name ?? "unknown"}`,
        r.job_title ? `Job title: ${r.job_title}` : null,
        r.company ? `Company: ${r.company}${r.company_domain ? ` (${r.company_domain})` : ""}` : null,
        r.location ? `Location: ${r.location}` : null,
        r.linkedin_url ? `LinkedIn: ${r.linkedin_url}` : null,
        r.work_email ? `Work email: ${r.work_email} (${r.work_email_status ?? "unknown"})` : "Work email: not found",
        r.personal_email ? `Personal email: ${r.personal_email}` : null,
        r.phone ? `Mobile: ${r.phone}${r.phone_connect_rate ? ` (${r.phone_connect_rate} connect rate)` : ""}` : null,
        `Status: ${r.status}`,
      ].filter(Boolean);
      const structured = {
        id: r.id,
        title: [r.name ?? "Unknown", r.job_title, r.company].filter(Boolean).join(", "),
        text: lines.join("\n"),
        url: contactUrl(row.list_id, (lists as { source: string }).source, r.id),
        metadata: { ...r },
      };
      return { content: [{ type: "text", text: JSON.stringify(structured) }], structuredContent: structured };
    }),
  );
}
