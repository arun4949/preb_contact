import { NextResponse } from "next/server";
import { resend } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { log, logError } from "@/lib/jobs/shared";

export const maxDuration = 30;

/**
 * Resend contact events keep `profiles.product_news` in step with the Resend
 * contact: someone who unsubscribes through the link in a broadcast sees the
 * switch off in Settings, and vice versa. Svix signature over the raw body
 * (`RESEND_WEBHOOK_SECRET`), unknown event types are acknowledged and ignored.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const raw = await request.text();
  let event: ReturnType<ReturnType<typeof resend>["webhooks"]["verify"]>;
  try {
    const headers = {
      id: request.headers.get("svix-id") ?? "",
      timestamp: request.headers.get("svix-timestamp") ?? "",
      signature: request.headers.get("svix-signature") ?? "",
    };
    event = resend().webhooks.verify({ payload: raw, headers, webhookSecret: secret });
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (event.type !== "contact.updated" && event.type !== "contact.deleted") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const email = event.data.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true, ignored: "no email" });
  const productNews = event.type === "contact.updated" ? !event.data.unsubscribed : false;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ product_news: productNews }).ilike("email", email);
    if (error) throw new Error(error.message);
    log("resend.contact_synced", { type: event.type, productNews });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("resend.webhook_failed", error, { type: event.type });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
