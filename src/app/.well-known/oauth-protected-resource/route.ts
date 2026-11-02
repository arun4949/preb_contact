import { generateProtectedResourceMetadata, getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { mcpServerUrl, supabaseIssuer } from "@/lib/mcp/config";

/** Root fallback of the protected resource metadata (same document as the /mcp one). */
export function GET(req: Request) {
  const body = generateProtectedResourceMetadata({ authServerUrls: [supabaseIssuer()], resourceUrl: mcpServerUrl(getPublicOrigin(req)) });
  return Response.json(body, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
