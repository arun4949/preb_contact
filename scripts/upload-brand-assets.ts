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
  for (const [name, type] of [["logoName.png", "image/png"], ["logo.png", "image/png"], ["portrait_arun_round.png", "image/png"]] as const) {
    const body = await readFile(new URL(`../public/${name}`, import.meta.url));
    const { error } = await supabase.storage.from("brand").upload(name, body, { contentType: type, upsert: true, cacheControl: "31536000" });
    if (error) throw error;
    console.log("uploaded", `${url}/storage/v1/object/public/brand/${name}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
