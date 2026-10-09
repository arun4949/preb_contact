import { createClient } from "./client";

/**
 * Browser client whose realtime socket carries the user's JWT. Without it the
 * socket joins anonymously, RLS hides the rows, and `postgres_changes` never
 * fires for RLS-protected tables. Resolve it before subscribing.
 */
export async function createRealtimeClient() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.realtime.setAuth(data.session.access_token);
  return supabase;
}
