/**
 * MCP server (AI assistants): shared constants. The server lives at
 * `<app origin>/mcp`; Supabase Auth's OAuth 2.1 server is the authorization
 * server (dynamic client registration + PKCE), so Claude, ChatGPT and other
 * MCP clients sign a user in without any API key.
 */

/** Path of the MCP endpoint (streamable HTTP). */
export const MCP_PATH = "/mcp";

/** Path of the RFC 9728 protected resource metadata for the MCP endpoint. */
export const MCP_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource/mcp";

/** Path of the OAuth consent page (Supabase dashboard: Authentication > OAuth Server > Authorization Path). */
export const OAUTH_CONSENT_PATH = "/oauth/consent";

/** Most contacts one `enrich_contacts` call accepts (one provider batch). */
export const MCP_MAX_CONTACTS = 100;

/** Default and ceiling for how long `enrich_contacts` waits for results before answering. */
export const MCP_DEFAULT_WAIT_SECONDS = 45;
export const MCP_MAX_WAIT_SECONDS = 55;

/** Runs one connection may start per minute (abuse guard). */
export const MCP_RUNS_PER_MINUTE = 10;

/** Name and version reported to MCP clients. */
export const MCP_SERVER_INFO = { name: "Preb", version: "1.0.0" } as const;

/** Supabase Auth issuer (`iss` of every token it signs, and the OAuth authorization server). */
export function supabaseIssuer(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return `${url.replace(/\/$/, "")}/auth/v1`;
}

/** Public MCP server URL for the given app origin (what users paste into their assistant). */
export function mcpServerUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${MCP_PATH}`;
}

/**
 * The address users paste into their assistant. Fixed to production on
 * purpose: a local dev server or a tunnel must never leak into the docs or
 * the Integrations page (`NEXT_PUBLIC_APP_URL` points at a tunnel locally).
 */
export const PUBLIC_MCP_URL = "https://app.preb.co/mcp";

export function publicMcpServerUrl(): string {
  return PUBLIC_MCP_URL;
}
