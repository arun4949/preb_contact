import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

async function signOutAndRedirect(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}

/**
 * GET: used by the app layout when the session cookie carries valid claims but
 * the user no longer exists (deleted account, stale cookie from another
 * environment). Without clearing the cookie, /lists → /login → /lists loops.
 */
export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}
