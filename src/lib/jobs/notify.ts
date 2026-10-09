import "server-only";

import { sendEmail } from "@/lib/email/resend";
import { ListFinishedEmail } from "@/lib/email/templates/list-finished";
import { ListPausedEmail } from "@/lib/email/templates/list-paused";
import { OpsAlertEmail } from "@/lib/email/templates/ops-alert";
import { firstNameFor } from "@/lib/email/name";
import { listFailedCopy, listFinishedCopy, listPausedCreditsCopy, listPausedUpstreamCopy } from "@/lib/notifications/copy";
import { notifyUsers } from "@/lib/notifications/emit";
import { logError, type Admin, type ListRow } from "./shared";

async function creator(admin: Admin, list: Pick<ListRow, "created_by">): Promise<{ email: string; firstName: string } | null> {
  const { data } = await admin.from("profiles").select("email, full_name").eq("id", list.created_by).maybeSingle();
  return data?.email ? { email: data.email, firstName: firstNameFor(data.full_name, data.email) } : null;
}

/** Engine emails never throw — a failed notification must not break settlement. In-app rows go to the list creator first. */
export async function notifyListFinished(admin: Admin, list: ListRow, stopped = false) {
  await notifyUsers(admin, [list.created_by], listFinishedCopy(list, stopped), { workspaceId: list.workspace_id });
  try {
    const recipient = await creator(admin, list);
    if (!recipient) return;
    await sendEmail({
      to: recipient.email,
      kind: "list_finished",
      workspaceId: list.workspace_id,
      subject: stopped ? `${list.name} was stopped` : `${list.name} is ready`,
      react: ListFinishedEmail({
        firstName: recipient.firstName,
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
  await notifyUsers(admin, [list.created_by], listPausedCreditsCopy(list, remaining), { workspaceId: list.workspace_id });
  try {
    const recipient = await creator(admin, list);
    if (!recipient) return;
    await sendEmail({
      to: recipient.email,
      kind: "list_paused",
      workspaceId: list.workspace_id,
      subject: `${list.name} is paused, add credits to continue`,
      react: ListPausedEmail({ firstName: recipient.firstName, listId: list.id, listName: list.name, processed: list.processed_rows, remaining }),
    });
  } catch (error) {
    logError("notify.list_paused_failed", error, { listId: list.id });
  }
}

/** In-app only (ops gets the email): the provider paused us, the list resumes by itself. */
export async function notifyListPausedUpstream(admin: Admin, list: ListRow) {
  await notifyUsers(admin, [list.created_by], listPausedUpstreamCopy(list), { workspaceId: list.workspace_id });
}

/** In-app only (ops gets the email): the provider rejected the list repeatedly. */
export async function notifyListFailed(admin: Admin, list: ListRow) {
  await notifyUsers(admin, [list.created_by], listFailedCopy(list), { workspaceId: list.workspace_id });
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
