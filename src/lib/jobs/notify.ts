import "server-only";

import { sendEmail } from "@/lib/email/resend";
import { ListFinishedEmail } from "@/lib/email/templates/list-finished";
import { ListPausedEmail } from "@/lib/email/templates/list-paused";
import { OpsAlertEmail } from "@/lib/email/templates/ops-alert";
import { logError, type Admin, type ListRow } from "./shared";

async function creatorEmail(admin: Admin, list: Pick<ListRow, "created_by">): Promise<string | null> {
  const { data } = await admin.from("profiles").select("email").eq("id", list.created_by).maybeSingle();
  return data?.email ?? null;
}

/** Engine emails never throw — a failed notification must not break settlement. */
export async function notifyListFinished(admin: Admin, list: ListRow, stopped = false) {
  try {
    const to = await creatorEmail(admin, list);
    if (!to) return;
    await sendEmail({
      to,
      kind: "list_finished",
      workspaceId: list.workspace_id,
      subject: stopped ? `${list.name} was stopped` : `${list.name} is enriched`,
      react: ListFinishedEmail({
        listId: list.id,
        listName: list.name,
        processed: list.processed_rows,
        validEmails: list.found_work_email,
        riskyEmails: list.risky_email,
        mobiles: list.found_phone,
        creditsUsed: list.credits_used,
        stopped,
      }),
    });
  } catch (error) {
    logError("notify.list_finished_failed", error, { listId: list.id });
  }
}

export async function notifyListPaused(admin: Admin, list: ListRow, remaining: number) {
  try {
    const to = await creatorEmail(admin, list);
    if (!to) return;
    await sendEmail({
      to,
      kind: "list_paused",
      workspaceId: list.workspace_id,
      subject: `${list.name} is paused — add credits to continue`,
      react: ListPausedEmail({ listId: list.id, listName: list.name, processed: list.processed_rows, remaining }),
    });
  } catch (error) {
    logError("notify.list_paused_failed", error, { listId: list.id });
  }
}

export function opsEmail(): string | null {
  const explicit = process.env.OPS_ALERT_EMAIL?.trim();
  if (explicit) return explicit;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return admins[0] ?? null;
}

export async function notifyOps(title: string, lines: string[]) {
  try {
    const to = opsEmail();
    if (!to) return;
    await sendEmail({ to, kind: "ops_alert", subject: `[Preb ops] ${title}`, react: OpsAlertEmail({ title, lines }) });
  } catch (error) {
    logError("notify.ops_failed", error, { title });
  }
}
