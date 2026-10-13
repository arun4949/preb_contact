import "server-only";

import type { Admin } from "@/lib/jobs/shared";
import { log } from "@/lib/jobs/shared";
import { cacheHashesFor, identifierHash, maskIdentifier, type SuppressionKind } from "./identifiers";

export type SuppressionSource = "admin" | "opt_out";

/**
 * Puts one normalised identifier on the suppression list and clears everything
 * stored for it (privacy policy § 12). Shared by the founder page, the
 * self-service confirmation and the review queue, so every path behaves the
 * same. Only the hash and a masked hint are stored; the raw value is used once
 * by the clearing RPC and then discarded.
 */
export async function suppressIdentifier(
  admin: Admin,
  kind: SuppressionKind,
  value: string,
  options: { source: SuppressionSource; createdBy?: string | null; note?: string | null; requestId?: string | null },
): Promise<{ cleared: number; hint: string }> {
  const hint = maskIdentifier(kind, value);
  const { error } = await admin.from("contact_suppressions").upsert(
    {
      kind,
      value_hash: identifierHash(kind, value),
      value_hint: hint,
      note: options.note?.trim() || null,
      created_by: options.createdBy ?? null,
      source: options.source,
      request_id: options.requestId ?? null,
    },
    { onConflict: "kind,value_hash" },
  );
  if (error) throw new Error(`suppression upsert: ${error.message}`);

  const { data: cleared, error: scanErr } = await admin.rpc("apply_contact_suppression", { p_kind: kind, p_value: value, p_cache_hashes: cacheHashesFor(kind, value) });
  if (scanErr) throw new Error(`Saved, but clearing stored data failed: ${scanErr.message}`);
  log("suppression.added", { kind, source: options.source, cleared: cleared ?? 0 });
  return { cleared: cleared ?? 0, hint };
}
