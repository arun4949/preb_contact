"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { findArticle } from "./registry";

export type DocsFeedbackResult = { ok: true } | { ok: false; error: string };

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;

/** Best-effort throttle per server instance. The key is a hash of ip + user agent and is never stored. */
const votes = new Map<string, { count: number; windowStart: number }>();

function throttled(key: string, now: number) {
  for (const [k, v] of votes) if (now - v.windowStart > WINDOW_MS) votes.delete(k);
  const entry = votes.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    votes.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

/** Records one anonymous vote for an article. Slugs are validated against the registry. */
export async function submitDocsFeedback(slug: string, helpful: boolean): Promise<DocsFeedbackResult> {
  if (typeof slug !== "string" || typeof helpful !== "boolean" || !findArticle(slug)) {
    return { ok: false, error: "Unknown article." };
  }
  const h = await headers();
  const key = createHash("sha256")
    .update(`${h.get("x-forwarded-for") ?? ""}|${h.get("user-agent") ?? ""}`)
    .digest("hex");
  if (throttled(key, Date.now())) return { ok: false, error: "Too many votes. Please try again later." };

  const { error } = await createAdminClient().from("docs_feedback").insert({ article_slug: slug, helpful });
  if (error) return { ok: false, error: "Could not save your vote." };
  return { ok: true };
}
