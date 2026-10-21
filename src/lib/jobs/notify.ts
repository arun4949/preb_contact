import "server-only";

import { sendEmail } from "@/lib/email/resend";
import { ListFinishedEmail } from "@/lib/email/templates/list-finished";
import { ListPausedEmail } from "@/lib/email/templates/list-paused";
import { OpsAlertEmail } from "@/lib/email/templates/ops-alert";
import { firstNameFor } from "@/lib/email/name";
import { listFailedCopy, listFinishedCopy, listPausedCreditsCopy, listPausedUpstreamCopy, type PauseReason } from "@/lib/notifications/copy";
import { notifyUsers } from "@/lib/notifications/emit";
import { isInternalWorkspace, logError, type Admin, type ListRow } from "./shared";

/** Lead magnet lists live in the internal workspace; admins open them on /admin/leads, not /lists/[id]. */
async function withKind(admin: Admin, list: ListRow): Promise<ListRow & { workspace_kind: string }> {
  const internal = await isInternalWorkspace(admin, list.workspace_id);
  return { ...list, workspace_kind: internal ? "internal" : "customer" };
}

const emailHref = (list: { id: string; workspace_kind: string }) => (list.workspace_kind === "internal" ? `/admin/leads?list=${list.id}` : undefined);

async function creator(admin: Admin, list: Pick<ListRow, "created_by">): Promise<{ email: string; firstName: string } | null> {
  const { data } = await admin.from("profiles").select("email, full_name").eq("id", list.created_by).maybeSingle();
  return data?.email ? { email: data.email, firstName: firstNameFor(data.full_name, data.email) } : null;
}

/** Engine emails never throw — a failed notification must not break settlement. In-app rows go to the list creator first. */
export async function notifyListFinished(admin: Admin, input: ListRow, stopped = false) {
  const list = await withKind(admin, input);
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
        catchAllEmails: list.risky_email,
        mobiles: list.found_phone,
        creditsUsed: list.credits_used,
        stopped,
        href: emailHref(list),
      }),
    });
  } catch (error) {
    logError("notify.list_finished_failed", error, { listId: list.id });
  }
}

const PAUSED_SUBJECT: Record<PauseReason, (name: string) => string> = {
  credits: (name) => `${name} is paused, add credits to continue`,
  overspend_limit: (name) => `${name} is paused, your monthly overspend limit is reached`,
  overspend_payment: (name) => `${name} is paused, an overspend payment failed`,
};

export async function notifyListPaused(admin: Admin, input: ListRow, remaining: number, reason: PauseReason = "credits") {
  const list = await withKind(admin, input);
  await notifyUsers(admin, [list.created_by], listPausedCreditsCopy(list, remaining, reason), { workspaceId: list.workspace_id });
  try {
    const recipient = await creator(admin, list);
    if (!recipient) return;
    await sendEmail({
      to: recipient.email,
      kind: "list_paused",
      workspaceId: list.workspace_id,
      subject: PAUSED_SUBJECT[reason](list.name),
      react: ListPausedEmail({ firstName: recipient.firstName, listId: list.id, listName: list.name, processed: list.processed_rows, remaining, href: emailHref(list), reason }),
    });
  } catch (error) {
    logError("notify.list_paused_failed", error, { listId: list.id });
  }
}

/** In-app only (ops gets the email): the provider paused us, the list resumes by itself. */
export async function notifyListPausedUpstream(admin: Admin, input: ListRow) {
  const list = await withKind(admin, input);
  await notifyUsers(admin, [list.created_by], listPausedUpstreamCopy(list), { workspaceId: list.workspace_id });
}

/** In-app only (ops gets the email): the provider rejected the list repeatedly. */
export async function notifyListFailed(admin: Admin, input: ListRow) {
  const list = await withKind(admin, input);
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
