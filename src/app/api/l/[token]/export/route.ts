import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/auth/work-email";
import { leadCookieName, verifyLeadAccess } from "@/lib/leads/access-cookie";
import { logShareEvent, touchShare } from "@/lib/leads/events";
import { getShareByToken } from "@/lib/leads/queries";
import { exportListCsv } from "@/lib/lists/export-stream";
import { isSegment } from "@/lib/lists/segments";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/queries";

export const maxDuration = 60;

/** CSV download on the lead share page: needs the access cookie (or an admin session). Counts as engagement. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const segmentParam = request.nextUrl.searchParams.get("segment") ?? "all";
  if (!isSegment(segmentParam)) return Response.json({ error: "Unknown segment" }, { status: 400 });

  const found = await getShareByToken(token);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  const { share, list } = found;

  const user = await getUser();
  const isAdmin = Boolean(user?.email && isAdminEmail(user.email));
  const cookieValue = (await cookies()).get(leadCookieName(share.id))?.value;
  if (!isAdmin && (share.revoked_at || !verifyLeadAccess(share.id, cookieValue))) return Response.json({ error: "Not allowed" }, { status: 403 });
  if (list.status === "draft") return Response.json({ error: "This list has not been started" }, { status: 409 });

  const admin = createAdminClient();
  if (!isAdmin) {
    await admin.from("lead_shares").update({ download_count: share.download_count + 1 }).eq("id", share.id);
    await touchShare(admin, share.id);
    await logShareEvent(admin, share.id, "downloaded", { segment: segmentParam });
  }
  return exportListCsv(admin, list, segmentParam);
}
