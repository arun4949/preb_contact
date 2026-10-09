import "server-only";

import type { TablesInsert } from "@/lib/supabase/types";
import { logError, type Admin } from "@/lib/jobs/shared";
import type { NotificationCopy } from "./copy";

/**
 * Writes in-app notifications with the service role. Never throws: a failed
 * notification must not break settlement, a webhook or a server action.
 */
export interface EmitOptions {
  workspaceId?: string | null;
  /** Unique per user; a repeated key is silently ignored (idempotent emitters). */
  dedupeKey?: string | null;
  data?: Record<string, unknown>;
}

type Row = TablesInsert<"notifications">;

function toRow(userId: string, copy: NotificationCopy, options: EmitOptions): Row {
  return {
    user_id: userId,
    workspace_id: options.workspaceId ?? null,
    kind: copy.kind,
    title: copy.title,
    body: copy.body,
    href: copy.href,
    status: copy.status,
    dedupe_key: options.dedupeKey ?? null,
    data: (options.data ?? {}) as Row["data"],
  };
}

/** Insert one notification per user. Returns how many rows were written (0 on failure). */
export async function notifyUsers(admin: Admin, userIds: readonly string[], copy: NotificationCopy, options: EmitOptions = {}): Promise<number> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return 0;
  try {
    const rows = ids.map((id) => toRow(id, copy, options));
    const query = options.dedupeKey
      ? admin.from("notifications").upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id")
      : admin.from("notifications").insert(rows).select("id");
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  } catch (error) {
    logError("notify.insert_failed", error, { kind: copy.kind, recipients: ids.length });
    return 0;
  }
}

export interface WorkspaceAudience {
  /** Restrict to these roles (default: every member). */
  roles?: readonly ("owner" | "admin" | "member")[];
  /** Leave these users out (e.g. the actor). */
  except?: readonly string[];
}

/** Members of a workspace, optionally filtered by role. Empty on failure. */
export async function workspaceRecipients(admin: Admin, workspaceId: string, audience: WorkspaceAudience = {}): Promise<{ userId: string; role: "owner" | "admin" | "member" }[]> {
  try {
    let query = admin.from("workspace_members").select("user_id, role").eq("workspace_id", workspaceId);
    if (audience.roles?.length) query = query.in("role", [...audience.roles]);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const except = new Set(audience.except ?? []);
    return (data ?? []).filter((m) => !except.has(m.user_id)).map((m) => ({ userId: m.user_id, role: m.role }));
  } catch (error) {
    logError("notify.recipients_failed", error, { workspaceId });
    return [];
  }
}

/**
 * Notify workspace members. `copy` may be a function of the member's role so
 * owners/admins can get a billing link while members get plain news.
 */
export async function notifyWorkspace(
  admin: Admin,
  workspaceId: string,
  copy: NotificationCopy | ((role: "owner" | "admin" | "member") => NotificationCopy),
  options: EmitOptions & WorkspaceAudience = {},
): Promise<number> {
  const members = await workspaceRecipients(admin, workspaceId, options);
  const emit = { ...options, workspaceId };
  if (typeof copy !== "function") return notifyUsers(admin, members.map((m) => m.userId), copy, emit);
  let written = 0;
  const byRole = new Map<"owner" | "admin" | "member", string[]>();
  for (const m of members) byRole.set(m.role, [...(byRole.get(m.role) ?? []), m.userId]);
  for (const [role, ids] of byRole) written += await notifyUsers(admin, ids, copy(role), emit);
  return written;
}
