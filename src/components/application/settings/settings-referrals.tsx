"use client";

import { useCallback, useEffect, useState } from "react";
import { RiCheckLine, RiFileCopyLine, RiGiftLine, RiMailSendLine, RiUserAddLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { CopiedBubble, useCopyFeedback } from "@/components/base/copy-feedback/copy-feedback";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { fetchReferralOverview, type ReferralEntry, type ReferralOverview } from "@/lib/referrals/actions";
import { docsPath } from "@/lib/site-links";
import { initialsOf } from "@/utils/initials";
import { cx } from "@/utils/cx";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

const fmt = (n: number) => n.toLocaleString("en-US");
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const dateYear = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Absolute link built in the browser, so dev and prod both get the right origin. */
const absolute = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);

const STATUS: Record<ReferralEntry["status"], { label: string; color: "yellow" | "lime" | "neutral" | "rose" }> = {
  pending: { label: "Signed up", color: "yellow" },
  rewarded: { label: "Rewarded", color: "lime" },
  expired: { label: "Expired", color: "neutral" },
  revoked: { label: "Revoked", color: "rose" },
};

/** The email the referrer sends from their own mail client (Preb never emails the invitee). */
function mailtoFor(data: ReferralOverview, url: string) {
  const subject = "Try Preb, verified contact data for recruiting";
  const body = [
    "Hi,",
    "",
    `I use Preb to find verified work emails and mobile numbers for candidates. Thought it could help you too. With my link you start with ${fmt(data.trialCredits)} free credits:`,
    "",
    url,
    "",
    data.firstName ? `Best,\n${data.firstName}` : "Best",
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Settings › Invite friends: the workspace's referral link and code, share
 * actions, what was earned so far and every referral with its status. Any
 * member can share; credits land in the workspace.
 */
export function SettingsReferrals() {
  const [data, setData] = useState<ReferralOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopyFeedback();

  const load = useCallback(() => {
    fetchReferralOverview()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Could not load your invite link."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <EmptyState size="inline" icon={RiGiftLine} title="Invite friends unavailable" description={error} actions={<Button variant="secondary" onClick={load}>Retry</Button>} />;
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[132px] w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-[120px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!data.code || !data.path) {
    return (
      <div className="rounded-2xl bg-background-secondary-default">
        <EmptyState size="inline" icon={RiGiftLine} title="Not available for this workspace" description="The internal workspace cannot take part in the referral programme." />
      </div>
    );
  }

  const url = absolute(data.path);
  const stats = [
    { label: "Link opened", value: fmt(data.stats.clicks) },
    { label: "Signed up", value: fmt(data.stats.signups) },
    { label: "Started a plan", value: fmt(data.stats.rewarded) },
    { label: "Credits earned", value: fmt(data.stats.creditsEarned) },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Hero */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border-button-default bg-background-primary-default p-5 sm:flex-row sm:items-center sm:gap-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-background-secondary-default">
          <RiGiftLine className="size-6 text-foreground-icon-primary" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-headline-medium text-text-primary">Earn {fmt(data.rewardCredits)} credits for every friend who starts a paid plan</h3>
          <p className="text-body-2-regular text-text-secondary">
            Share your link with people at other companies. When a friend creates an account through it and starts a plan within {data.windowDays} days, {fmt(data.rewardCredits)} credits
            land in this workspace. Your friend gets the usual {fmt(data.trialCredits)} free trial credits.
          </p>
        </div>
      </div>

      {/* Link and code */}
      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>Your invite link</SettingsSectionLabel>
        <div className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code dir="ltr" className="min-w-0 flex-1 truncate rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2 text-body-regular text-text-primary">
              {url}
            </code>
            <div className="flex items-center gap-2">
              <span className="relative inline-flex">
                <Button variant="secondary" size="small" leadingIcon={copied === "link" ? RiCheckLine : RiFileCopyLine} onClick={() => void copy(url, "link")} aria-label="Copy invite link">
                  {copied === "link" ? "Copied" : "Copy link"}
                </Button>
                <CopiedBubble show={copied === "link"} label="Link copied" className="sr-only" />
              </span>
              <ButtonLink href={mailtoFor(data, url)} size="small" leadingIcon={RiMailSendLine}>
                Share by email
              </ButtonLink>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-body-2-regular text-text-secondary">
              Your code is{" "}
              <button
                type="button"
                onClick={() => void copy(data.code!, "code")}
                className="relative inline-flex cursor-pointer items-center rounded-md font-mono text-body-2-medium tracking-[0.2em] text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                aria-label="Copy invite code"
                dir="ltr"
              >
                {data.code}
                <CopiedBubble show={copied === "code"} label="Code copied" />
              </button>
              , in case someone would rather type it.
            </p>
            <p className="text-caption-1-regular text-text-tertiary">Share by email opens your own mail app. Preb never emails your friends.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 rounded-2xl bg-background-secondary-default px-4 py-3">
            <span className="text-body-2-regular text-text-secondary">{s.label}</span>
            <span className="text-title-3-semibold tabular-nums text-text-primary">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Referrals */}
      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>{data.referrals.length === 0 ? "Your referrals" : `${data.referrals.length} ${data.referrals.length === 1 ? "referral" : "referrals"}`}</SettingsSectionLabel>
        {data.referrals.length === 0 ? (
          <div className="rounded-2xl bg-background-secondary-default">
            <EmptyState size="inline" icon={RiUserAddLine} title="No one has signed up yet" description="Friends who create an account through your link appear here, with their status." />
          </div>
        ) : (
          <SettingsCard>
            {data.referrals.map((r) => {
              const status = STATUS[r.status];
              return (
                <div key={r.id} className="flex min-h-[52px] w-full flex-wrap items-center justify-between gap-3 border-b border-separator-border py-2.5 pe-2.5 last:border-b-0">
                  <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
                    <Avatar size="sm" alt="" initials={initialsOf(r.maskedEmail)} color="neutral" />
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-body-regular text-text-primary" dir="ltr">
                        {r.maskedEmail}
                      </p>
                      <p className="text-body-2-regular text-text-secondary">
                        {r.status === "rewarded" && r.rewardedAt
                          ? `Started a plan on ${date(r.rewardedAt)} · ${fmt(r.rewardCredits ?? 0)} credits earned`
                          : r.status === "pending"
                            ? `Signed up ${date(r.signedUpAt)} · counts until ${date(r.expiresAt)}`
                            : r.status === "expired"
                              ? `Signed up ${date(r.signedUpAt)} · no plan within ${data.windowDays} days`
                              : `Signed up ${date(r.signedUpAt)} · reward withdrawn`}
                      </p>
                    </div>
                  </div>
                  <Chip variant="caption" color={status.color} className={cx("ms-auto shrink-0")}>
                    {status.label}
                  </Chip>
                </div>
              );
            })}
          </SettingsCard>
        )}
      </div>

      {/* Rules */}
      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>How it works</SettingsSectionLabel>
        <SettingsCard>
          <SettingsRow label="Who counts" description="A new account at another company that signs up through your link. Teammates on your own domain belong in this workspace as members instead." />
          <SettingsRow label="When you earn" description={`When your friend's workspace pays its first subscription invoice within ${data.windowDays} days of signing up. Once per person.`} />
          <SettingsRow label="What you get" description={`${fmt(data.rewardCredits)} credits in this workspace, valid for ${data.expiryMonths} months and used after credits that expire sooner.`} />
          <SettingsRow label="Fair use" description="Invites to your own other accounts or a ring of accounts do not count, and rewards for referrals that were not genuine can be withdrawn.">
            <ButtonLink href={docsPath("billing", "referral-program")} target="_blank" rel="noreferrer" variant="secondary" size="small" className="shrink-0">
              Read the rules
            </ButtonLink>
          </SettingsRow>
        </SettingsCard>
      </div>
      <p className="sr-only" aria-live="polite">
        {data.referrals.length === 0 ? "" : `Credits earned so far: ${fmt(data.stats.creditsEarned)} and valid until ${dateYear(new Date().toISOString())}`}
      </p>
    </div>
  );
}
