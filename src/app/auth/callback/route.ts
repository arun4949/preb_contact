import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { redirectOrigin } from "@/lib/auth/origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, isFreeEmailDomain } from "@/lib/auth/work-email";
import { finishInviteeSignup } from "@/lib/auth/first-login";

/** OAuth (PKCE) return: exchange the code for a session, then continue to `next`. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = redirectOrigin(request);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/lists";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/lists";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user;
      const email = user?.email?.toLowerCase() ?? "";
      if (user && isFreeEmailDomain(email) && !isAdminEmail(email)) {
        const admin = createAdminClient();
        const { count: memberships } = await admin
          .from("workspace_members")
          .select("user_id", { count: "exact", head: true })
          .eq("user_id", user.id);
        const { count: invites } = await admin
          .from("workspace_invites")
          .select("id", { count: "exact", head: true })
          .ilike("email", email)
          .gt("expires_at", new Date().toISOString());
        // Brand-new free-mail account with no invite: it was created seconds
        // ago by the OAuth exchange, so remove it again (cascades to profile,
        // workspace, membership) and explain.
        const createdJustNow = Date.now() - new Date(user.created_at).getTime() < 60_000;
        if (!invites && (createdJustNow || !memberships)) {
          await supabase.auth.signOut();
          if (createdJustNow) await admin.auth.admin.deleteUser(user.id);
          return NextResponse.redirect(`${origin}/login?error=work_email`);
        }
      }
      if (user) await finishInviteeSignup(user.id);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}
