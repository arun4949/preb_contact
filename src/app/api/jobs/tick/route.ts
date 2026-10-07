import { NextResponse } from "next/server";

/**
 * Dispatcher / reconciler / settler entry point (Vercel Cron every minute and
 * `after()` from `startList`). The engine lands on day 3; until then this
 * route only validates the secret so the wiring can be tested.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ran: false, note: "dispatcher not implemented yet" });
}

export const POST = GET;
