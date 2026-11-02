import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";
import { assistantFromClientName } from "./clients";

/**
 * Which workspace an assistant works in. The consent page stores one
 * `mcp_connections` row per (user, OAuth client) and Disconnect deletes it.
 * The row is required: an access token stays valid until it expires (one
 * hour), so without this check a disconnected assistant could keep working
 * against the default workspace. Membership is checked on every call too, so
 * a removed member loses access at once.
 */

export type Admin = ReturnType<typeof createAdminClient>;

export interface McpContext {
  admin: Admin;
  userId: string;
  clientId: string;
  workspace: Tables<"workspaces">;
  role: Tables<"workspace_members">["role"];
  /** Display name of the assistant ("Claude", "ChatGPT", …). */
  assistantName: string;
}

export class McpAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpAccessError";
  }
}

export async function resolveMcpContext(userId: string, clientId: string): Promise<McpContext> {
  const admin = createAdminClient();
  const { data: connection } = await admin.from("mcp_connections").select("workspace_id, client_name").eq("user_id", userId).eq("client_id", clientId).maybeSingle();
  if (!connection) throw new McpAccessError("This assistant was disconnected in Preb. Connect it again from your assistant to continue.");
  const workspaceId = connection.workspace_id;

  const { data: membership } = await admin
    .from("workspace_members")
    .select("role, workspace:workspaces(*)")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!membership?.workspace) throw new McpAccessError("You are no longer a member of the workspace this connection uses. Disconnect Preb in your assistant and connect again.");

  const assistantName = assistantFromClientName(connection.client_name).name;

  // Usage bookkeeping off the request path (fire and forget).
  after(async () => {
    try {
      const { data: row } = await admin.from("mcp_connections").select("tool_calls").eq("user_id", userId).eq("client_id", clientId).maybeSingle();
      if (row) {
        await admin
          .from("mcp_connections")
          .update({ tool_calls: row.tool_calls + 1, last_used_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("client_id", clientId);
      }
    } catch {
      // Bookkeeping only.
    }
  });

  return { admin, userId, clientId, workspace: membership.workspace as Tables<"workspaces">, role: membership.role, assistantName };
}
