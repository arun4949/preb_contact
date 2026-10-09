import type { NotificationKind, NotificationStatus } from "./types";

/**
 * Copy for every workspace notification, kept pure so it can be unit-tested.
 * Rules (AGENTS.md): no dashes as punctuation, full sentences, en-US numbers.
 */
export interface NotificationCopy {
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  status: NotificationStatus;
}

const n = (value: number) => value.toLocaleString("en-US");
const day = (iso: string | Date) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`;

export interface ListCopyInput {
  id: string;
  name: string;
  source: string;
  processed_rows: number;
  found_work_email: number;
  found_personal_email: number;
  found_phone: number;
  identified_rows: number;
  credits_used: number;
}

const listHref = (list: Pick<ListCopyInput, "id" | "source">) => (list.source === "manual" ? "/enrich" : `/lists/${list.id}`);
const listLabel = (list: Pick<ListCopyInput, "name" | "source">) => (list.source === "manual" ? `Enrichment of ${list.name}` : list.name);

export function listFinishedCopy(list: ListCopyInput, stopped: boolean): NotificationCopy {
  const found: string[] = [];
  if (list.found_work_email > 0) found.push(plural(list.found_work_email, "work email", "work emails"));
  if (list.found_personal_email > 0) found.push(plural(list.found_personal_email, "personal email", "personal emails"));
  if (list.found_phone > 0) found.push(plural(list.found_phone, "mobile number", "mobile numbers"));
  if (list.identified_rows > 0) found.push(plural(list.identified_rows, "contact identified", "contacts identified"));
  const summary = found.length ? `${found.join(", ")} found.` : "Nothing new was found.";
  return {
    kind: stopped ? "list_stopped" : "list_finished",
    title: stopped ? `${listLabel(list)} was stopped` : `${listLabel(list)} is ready`,
    body: `${plural(list.processed_rows, "contact", "contacts")} processed. ${summary} ${plural(list.credits_used, "credit", "credits")} used.`,
    href: listHref(list),
    status: stopped ? "neutral" : "success",
  };
}

export function listPausedCreditsCopy(list: Pick<ListCopyInput, "id" | "name" | "source">, remaining: number): NotificationCopy {
  return {
    kind: "list_paused_credits",
    title: `${listLabel(list)} is paused`,
    body: `${plural(remaining, "contact is", "contacts are")} waiting for credits. Add credits and it continues on its own.`,
    href: `${listHref(list)}?settings=billing&plan=1`,
    status: "error",
  };
}

export function listPausedUpstreamCopy(list: Pick<ListCopyInput, "id" | "name" | "source">): NotificationCopy {
  return {
    kind: "list_paused_upstream",
    title: `${listLabel(list)} is paused on our side`,
    body: "Enrichment resumes automatically within a few minutes. No credits are lost.",
    href: listHref(list),
    status: "information",
  };
}

export function listFailedCopy(list: Pick<ListCopyInput, "id" | "name" | "source">): NotificationCopy {
  return {
    kind: "list_failed",
    title: `${listLabel(list)} could not be enriched`,
    body: "The enrichment service rejected it repeatedly. Our team has been notified and your credits were released.",
    href: listHref(list),
    status: "error",
  };
}

export function creditsLowCopy(input: { workspaceName: string; available: number; planCredits: number; canBuy: boolean }): NotificationCopy {
  return {
    kind: "credits_low",
    title: `${input.workspaceName} is running low on credits`,
    body: `${n(input.available)} of ${n(input.planCredits)} credits left. ${input.canBuy ? "Buy credits to keep your lists running." : "Ask an owner or admin to add credits."}`,
    href: input.canBuy ? "/lists?settings=billing&plan=1" : null,
    status: "error",
  };
}

export function creditsGrantedCopy(input: { credits: number; note: string; expiresAt: string | Date }): NotificationCopy {
  return {
    kind: "credits_granted",
    title: `${n(input.credits)} credits added`,
    body: `${input.note}. They are valid until ${day(input.expiresAt)}.`,
    href: "/lists?settings=billing",
    status: "success",
  };
}

export function creditsExpiringCopy(input: { amount: number; expiresAt: string | Date; days: number; trial: boolean }): NotificationCopy {
  const when = input.days <= 0 ? "today" : input.days === 1 ? "tomorrow" : `in ${input.days} days`;
  return input.trial
    ? {
        kind: "trial_ending",
        title: `Your trial ends ${when}`,
        body: `${n(input.amount)} trial credits expire on ${day(input.expiresAt)}. Choose a plan to keep enriching.`,
        href: "/lists?settings=billing&plan=1",
        status: "information",
      }
    : {
        kind: "credits_expiring",
        title: `${n(input.amount)} credits expire ${when}`,
        body: `Use them before ${day(input.expiresAt)}. Credits that are left after that date are lost.`,
        href: "/lists?settings=billing",
        status: "information",
      };
}

export type PlanChangeKind = "plan_started" | "plan_changed" | "plan_cancel_scheduled" | "plan_cancel_reverted" | "plan_canceled";

export function planCopy(kind: PlanChangeKind, input: { planName: string | null; previousPlanName?: string | null; periodEnd?: string | null }): NotificationCopy {
  const plan = input.planName ?? "your plan";
  const href = "/lists?settings=billing";
  switch (kind) {
    case "plan_started":
      return { kind, title: `Welcome to ${plan}`, body: "Your subscription is active. New credits arrive with every invoice.", href, status: "success" };
    case "plan_changed":
      return {
        kind,
        title: `Plan changed to ${plan}`,
        body: input.previousPlanName ? `You moved from ${input.previousPlanName}. The difference was invoiced right away.` : "The difference was invoiced right away.",
        href,
        status: "success",
      };
    case "plan_cancel_scheduled":
      return {
        kind,
        title: input.periodEnd ? `${plan} ends on ${day(input.periodEnd)}` : `${plan} ends at the end of the period`,
        body: "Credits you already have stay valid until they expire. You can resume the plan any time before then.",
        href,
        status: "information",
      };
    case "plan_cancel_reverted":
      return { kind, title: `${plan} continues`, body: "The scheduled cancellation was removed. Nothing else changes.", href, status: "success" };
    case "plan_canceled":
      return { kind, title: "Your plan was canceled", body: "No further invoices will be issued. Remaining credits stay valid until they expire.", href, status: "neutral" };
  }
}

export function memberRemovedCopy(workspaceName: string): NotificationCopy {
  return {
    kind: "member_removed",
    title: `You were removed from ${workspaceName}`,
    body: "You no longer have access to its lists. Ask an owner or admin for a new invite if this was a mistake.",
    href: null,
    status: "neutral",
  };
}

export function memberLeftCopy(name: string, workspaceName: string): NotificationCopy {
  return {
    kind: "member_left",
    title: `${name} left ${workspaceName}`,
    body: "Their lists stay in the workspace.",
    href: "/lists?settings=workspace",
    status: "neutral",
  };
}

export function workspaceDeletedCopy(workspaceName: string): NotificationCopy {
  return {
    kind: "workspace_deleted",
    title: `${workspaceName} was deleted`,
    body: "The owner deleted the workspace with all its lists and credits. Create your own workspace or ask a teammate for an invite.",
    href: null,
    status: "neutral",
  };
}

export function roleChangedCopy(workspaceName: string, role: "admin" | "member"): NotificationCopy {
  return {
    kind: "role_changed",
    title: role === "admin" ? `You are now an admin of ${workspaceName}` : `Your role in ${workspaceName} changed to member`,
    body: role === "admin" ? "You can invite teammates, manage roles and handle billing." : "You can still upload lists and enrich contacts.",
    href: "/lists?settings=workspace",
    status: "information",
  };
}
