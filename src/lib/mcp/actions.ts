"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUser } from "@/lib/supabase/queries";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Disconnect an assistant: revoke the OAuth grant (every token of that
 * client stops working) and forget the workspace mapping. The assistant
 * keeps its connector entry; the next use asks the user to sign in again.
 */
export async function disconnectAssistant(clientId: string): Promise<Result> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const id = String(clientId ?? "").trim().slice(0, 200);
  if (!id) return { ok: false, error: "Nothing to disconnect." };
  const supabase = await createClient();
  const { error: revokeErr } = await supabase.auth.oauth.revokeGrant({ clientId: id });
  // A grant that is already gone is fine: the mapping still goes.
  if (revokeErr && revokeErr.status !== 404) {
    console.error(JSON.stringify({ scope: "mcp", event: "disconnect.revoke_failed", error: revokeErr.message }));
    return { ok: false, error: "Preb could not revoke the connection. Please try again." };
  }
  await supabase.from("mcp_connections").delete().eq("user_id", user.id).eq("client_id", id);
  revalidatePath("/integrations");
  revalidatePath("/integrations/ai-assistants");
  return { ok: true };
}
