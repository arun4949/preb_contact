import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyBearer } from "@/lib/mcp/auth";
import { MCP_RESOURCE_METADATA_PATH, MCP_SERVER_INFO } from "@/lib/mcp/config";
import { MCP_INSTRUCTIONS, registerTools } from "@/lib/mcp/server";

/**
 * The Preb MCP server (streamable HTTP, stateless). Unauthenticated requests
 * get a 401 with a `WWW-Authenticate: Bearer resource_metadata=…` challenge,
 * which is how Claude and ChatGPT discover the OAuth flow. Public in the
 * proxy allowlist; the bearer token is the only credential.
 */
export const maxDuration = 60;

const handler = createMcpHandler((server) => registerTools(server), {
  serverInfo: { ...MCP_SERVER_INFO },
  instructions: MCP_INSTRUCTIONS,
});

const authed = withMcpAuth(handler, verifyBearer, { required: true, resourceMetadataPath: MCP_RESOURCE_METADATA_PATH });

export { authed as GET, authed as POST, authed as DELETE };
