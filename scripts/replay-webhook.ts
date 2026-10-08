/**
 * QA helper: re-send the latest stored provider webhook (terminal batch event)
 * to the local app, signed with our API key, and once with a bad signature.
 * Expected: first → { ok: true, duplicate: true } (idempotent), second → 401.
 *
 *   npm run qa:replay-webhook            (targets http://localhost:3000)
 *   npm run qa:replay-webhook -- <url>   (another origin)
 */
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const origin = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}
const apiKey = env("FULLENRICH_API_KEY");
const url = env("NEXT_PUBLIC_SUPABASE_URL");
const secret = env("SUPABASE_SECRET_KEY");

async function post(label: string, signature: string, raw: string) {
  const res = await fetch(`${origin}/api/webhooks/fullenrich`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature-sha1": signature },
    body: raw,
  });
  console.log(label, res.status, await res.text());
}

async function main() {
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { data: event, error } = await admin
    .from("webhook_events")
    .select("external_id, payload")
    .eq("provider", "fullenrich")
    .like("external_id", "%:batch:%")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !event) throw new Error(`No stored batch webhook: ${error?.message ?? "none"}`);

  const raw = JSON.stringify(event.payload);
  const sign = (key: string) => createHmac("sha1", key).update(raw, "utf8").digest("hex");


  console.log("replaying", event.external_id);
  await post("valid signature  →", sign(apiKey), raw);
  await post("bad signature    →", sign("not-the-key"), raw);
}

main().catch((e) => { console.error(e); process.exit(1); });
