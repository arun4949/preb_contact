import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";
import { supabaseIssuer } from "@/lib/mcp/config";

/**
 * RFC 9728 protected resource metadata for /mcp: tells an MCP client which
 * authorization server (Supabase Auth) signs the user in. Claude probes this
 * path-specific document first, then the root one.
 */
const handler = protectedResourceHandler({ authServerUrls: [supabaseIssuer()] });
const options = metadataCorsOptionsRequestHandler();

export { handler as GET, options as OPTIONS };
