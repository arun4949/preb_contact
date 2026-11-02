import "server-only";

import type { CallToolResult, ServerContext } from "@modelcontextprotocol/server";
import { principalOf } from "./auth";
import { McpAccessError, resolveMcpContext, type McpContext } from "./context";
import { failure } from "./format";

/**
 * Wraps a tool handler: resolves the signed-in user, the connected workspace
 * and the assistant from the verified bearer token, and turns access
 * problems into readable tool errors instead of protocol errors.
 */
export function withContext<Args>(handler: (ctx: McpContext, args: Args) => Promise<CallToolResult>) {
  return async (args: Args, serverCtx: ServerContext): Promise<CallToolResult> => {
    const principal = principalOf(serverCtx.http?.authInfo);
    if (!principal) return failure("This connection is not signed in. Reconnect Preb in your assistant and sign in again.");
    try {
      const ctx = await resolveMcpContext(principal.userId, principal.clientId);
      return await handler(ctx, args);
    } catch (e) {
      if (e instanceof McpAccessError) return failure(e.message);
      console.error(JSON.stringify({ scope: "mcp", event: "tool.failed", error: e instanceof Error ? e.message : String(e) }));
      return failure("Preb could not complete this request. Please try again in a moment.");
    }
  };
}
