/**
 * Uploads public brand assets (email logo, founder portrait) to the public `brand` bucket.
 *   npx tsx --env-file=.env.local scripts/upload-brand-assets.ts
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  // [file in public/, object name in the bucket]. Objects are cached for a
  // year, so changed artwork gets a new versioned object name (and the email
  // template points at it) instead of overwriting the old one.
  const assets = [
    ["logoName.png", "logoName-2026-11.png"],
    ["logo.png", "logo-2026-11.png"],
    ["portrait_arun_round.png", "portrait_arun_round.png"],
  ] as const;
  for (const [file, name] of assets) {
    const type = "image/png";
    const body = await readFile(new URL(`../public/${file}`, import.meta.url));
    const { error } = await supabase.storage.from("brand").upload(name, body, { contentType: type, upsert: true, cacheControl: "31536000" });
    if (error) throw error;
    console.log("uploaded", `${url}/storage/v1/object/public/brand/${name}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
