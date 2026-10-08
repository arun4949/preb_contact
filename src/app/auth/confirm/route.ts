import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { redirectOrigin } from "@/lib/auth/origin";
import { finishInviteeSignup } from "@/lib/auth/first-login";

/** Magic-link / invite return: verify the token hash, then continue to `next`. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = redirectOrigin(request);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/lists";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/lists";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (data.user) await finishInviteeSignup(data.user.id);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
