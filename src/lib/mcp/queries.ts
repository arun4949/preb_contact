import "server-only";

import { createClient } from "@/utils/supabase/server";
import { assistantFromClientName, type AssistantId } from "./clients";

/** One connected assistant of the signed-in user (RLS: own rows only). */
export interface AssistantConnection {
  clientId: string;
  assistant: AssistantId;
  clientName: string;
  workspaceId: string;
  workspaceName: string;
  toolCalls: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export async function getMyConnections(): Promise<AssistantConnection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mcp_connections")
    .select("client_id, client_name, workspace_id, tool_calls, last_used_at, created_at, workspace:workspaces(name)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    clientId: r.client_id,
    assistant: assistantFromClientName(r.client_name).id,
    clientName: r.client_name,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace?.name ?? "",
    toolCalls: r.tool_calls,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
  }));
}
