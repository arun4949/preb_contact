import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { registerCreditsTool } from "./tools/credits";
import { registerEstimateTool } from "./tools/estimate";
import { registerEnrichTool } from "./tools/enrich";
import { registerResultsTools } from "./tools/results";
import { registerSearchTools } from "./tools/search";

/** Instructions the assistant reads once per session. */
export const MCP_INSTRUCTIONS = [
  "Preb finds verified work emails, personal emails and mobile numbers for people (recruiting and sales). Input per person: a LinkedIn URL, or first name + last name + company, or only an email address.",
  "Credits are spent only for results found: work email 2, personal email 6, mobile phone 20, identifying a person from an email 2. Always call estimate_enrichment first, tell the user the typical and maximum credits, and start enrich_contacts only after they confirm.",
  "Results take one to two minutes. enrich_contacts waits briefly and returns what is ready; use get_enrichment_results with the run_id for the rest. Every run is also visible in the Preb app under Enrich.",
  "Email levels: Valid (safe to send), Probably valid, Catch-all (the domain accepts every address, so a bounce is possible). Never invent contact data; report 'not found' as such.",
].join(" ");

export function registerTools(server: McpServer) {
  registerCreditsTool(server);
  registerEstimateTool(server);
  registerEnrichTool(server);
  registerResultsTools(server);
  registerSearchTools(server);
}
