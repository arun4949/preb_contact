import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { Implementation } from "@modelcontextprotocol/server";
import { verifyBearer } from "@/lib/mcp/auth";
import { MCP_RESOURCE_METADATA_PATH, MCP_SERVER_INFO, PUBLIC_MCP_URL } from "@/lib/mcp/config";
import { MCP_INSTRUCTIONS, registerTools } from "@/lib/mcp/server";

/**
 * The Preb MCP server (streamable HTTP, stateless). Unauthenticated requests
 * get a 401 with a `WWW-Authenticate: Bearer resource_metadata=…` challenge,
 * which is how Claude and ChatGPT discover the OAuth flow. Public in the
 * proxy allowlist; the bearer token is the only credential.
 */
export const maxDuration = 60;

// `serverInfo` goes straight into the SDK's `Implementation`, which also
// carries icons and a website (MCP 2025-11): assistants that honour them show
// the Preb mark in colour instead of a tinted placeholder.
const serverInfo = {
  ...MCP_SERVER_INFO,
  title: "Preb",
  websiteUrl: "https://preb.co",
  icons: [{ src: `${PUBLIC_MCP_URL.replace(/\/mcp$/, "")}/icon-256.png`, mimeType: "image/png", sizes: ["256x256"] }],
} satisfies Implementation;

const handler = createMcpHandler((server) => registerTools(server), {
  serverInfo,
  instructions: MCP_INSTRUCTIONS,
});

const authed = withMcpAuth(handler, verifyBearer, { required: true, resourceMetadataPath: MCP_RESOURCE_METADATA_PATH });

export { authed as GET, authed as POST, authed as DELETE };
