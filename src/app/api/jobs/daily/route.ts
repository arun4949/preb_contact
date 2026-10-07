import { NextResponse } from "next/server";
import { runDaily } from "@/lib/jobs/daily";

export const maxDuration = 120;

/** Vercel Cron, once a day: expire grants, upstream balance alert, cleanup. */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runDaily();
  return NextResponse.json(summary, { status: summary.errors.length ? 207 : 200 });
}

export const GET = handle;
export const POST = handle;
