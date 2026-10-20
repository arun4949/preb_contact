"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiLink,
  RiLinkedinBoxLine,
  RiMoreFill,
  RiRedditLine,
  RiRefreshLine,
  RiUserStarLine,
} from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { ButtonLink } from "@/components/base/buttons/button";
import {
  CopiedBubble,
  useCopyFeedback,
} from "@/components/base/copy-feedback/copy-feedback";
import { ConfirmDialog } from "@/components/base/dialog/dialog";
import {
  Dropdown,
  DropdownDivider,
  DropdownGroup,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/base/segmented-control/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { useToast } from "@/components/base/toast/toast";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";
import {
  deleteLeadShare,
  regenerateLeadCode,
  regenerateLeadLink,
  setLeadShareRevoked,
  type LeadShareSummary,
} from "@/lib/leads/admin-actions";
import { leadProfileSource } from "@/lib/leads/profile-url";
import { initialsOf } from "@/utils/initials";
import { cx } from "@/utils/cx";
import { chatMessage, shareUrl } from "./new/share-dialog";

type Filter = "all" | "mine";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const n = (v: number) => v.toLocaleString("en-US");
/** "/l/HEtLd7…": enough to recognise the link, never the full token. */
const shortLink = (path: string) => `${path.slice(0, 9)}…`;

const PROFILE_LINK = {
  linkedin: { icon: RiLinkedinBoxLine, label: (name: string) => `${name} on LinkedIn` },
  reddit: { icon: RiRedditLine, label: (name: string) => `${name} on Reddit` },
  other: { icon: RiExternalLinkLine, label: (name: string) => `Open profile of ${name}` },
};

/** Where the lead came from: LinkedIn, Reddit or any other link. */
function ProfileLink({ url, leadName }: { url: string; leadName: string }) {
  const { icon: Icon, label } = PROFILE_LINK[leadProfileSource(url)];
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label(leadName)}
      className="rounded-sm text-foreground-icon-secondary outline-none hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
    >
      <Icon className="size-4" aria-hidden />
    </a>
  );
}

/** Short link in the table; copies the full URL and confirms in place (the link icon turns into a check). */
function CopyLinkCell({
  leadName,
  url,
  path,
}: {
  leadName: string;
  url: string;
  path: string;
}) {
  const { copied, copy } = useCopyFeedback();
  const done = copied !== null;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => void copy(url)}
        aria-label={`Copy link for ${leadName}`}
        title="Click to copy the full link"
        className="-mx-2 inline-flex cursor-copy items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-body-2-regular text-text-secondary outline-none transition-colors hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        dir="ltr"
      >
        <span className="relative inline-flex size-4 shrink-0">
          <RiLink
            className={cx(
              "absolute size-4 text-foreground-icon-secondary transition-[opacity,transform] duration-200 ease-out",
              done ? "scale-50 opacity-0" : "scale-100 opacity-100",
            )}
            aria-hidden
          />
          <RiCheckLine
            className={cx(
              "absolute size-4 text-notification-success-foreground transition-[opacity,transform] duration-200 ease-out",
              done ? "scale-100 opacity-100" : "scale-50 opacity-0",
            )}
            aria-hidden
          />
        </span>
        {shortLink(path)}
      </button>
      <CopiedBubble show={done} label="Link copied" />
    </span>
  );
}

/** The 4-digit code; copies it and confirms in place. */
function CopyCodeCell({ code }: { code: string }) {
  const { copied, copy } = useCopyFeedback();
  const done = copied !== null;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => void copy(code)}
        aria-label={`Copy code ${code}`}
        title="Click to copy"
        className={cx(
          "-mx-2 inline-flex cursor-copy items-center rounded-lg px-2 py-1 font-mono text-body-medium tracking-[0.2em] outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          done ? "text-notification-success-foreground" : "text-text-primary",
        )}
        dir="ltr"
      >
        {code}
      </button>
      <CopiedBubble show={done} label="Code copied" />
    </span>
  );
}

function Stage({ share }: { share: LeadShareSummary }) {
  if (share.revokedAt)
    return (
      <Chip variant="caption" color="neutral">
        Revoked
      </Chip>
    );
  if (share.signedUpAt)
    return (
      <Chip variant="caption" color="lime">
        Signed up
      </Chip>
    );
  if (share.downloadCount > 0)
    return (
      <Chip variant="caption" color="blue">
        Downloaded
      </Chip>
    );
  if (share.unlockedAt)
    return (
      <Chip variant="caption" color="blue">
        Unlocked
      </Chip>
    );
  if (share.firstOpenedAt)
    return (
      <Chip variant="caption" color="yellow">
        Opened
      </Chip>
    );
  return (
    <Chip variant="caption" color="neutral">
      Not opened
    </Chip>
  );
}

function EngagementTooltip({ share }: { share: LeadShareSummary }) {
  const lines = [
    ["Created", when(share.createdAt)],
    [
      "First opened",
      share.firstOpenedAt ? when(share.firstOpenedAt) : "not yet",
    ],
    ["Code entered", share.unlockedAt ? when(share.unlockedAt) : "not yet"],
    ["Last seen", share.lastSeenAt ? when(share.lastSeenAt) : "never"],
    ["Downloads", n(share.downloadCount)],
    ["Popup shown", share.popupShownAt ? when(share.popupShownAt) : "not yet"],
    ["Sign in / Sign up clicks", n(share.ctaClicks)],
    [
      "Signed up",
      share.signedUpAt
        ? `${when(share.signedUpAt)}${share.signedUp ? ` as ${share.signedUp.name ?? share.signedUp.email}` : ""}`
        : "not yet",
    ],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {lines.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-caption-1-regular opacity-70">{k}</dt>
          <dd className="text-caption-1-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Overview of every lead share with link, code, owner, enrichment state and engagement. */
export function LeadsAdmin({
  shares,
  meId,
  highlightListId,
}: {
  shares: LeadShareSummary[];
  meId: string;
  highlightListId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  /** Copies from a row menu: the menu closes on select, so the confirmation rises above that row's actions button. */
  const menuCopy = useCopyFeedback();
  const [filter, setFilter] = useState<Filter>("all");
  const [menu, setMenu] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LeadShareSummary | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(
    () =>
      filter === "mine"
        ? shares.filter((s) => s.owner.id === meId || s.createdBy === meId)
        : shares,
    [shares, filter, meId],
  );

  const stats = useMemo(() => {
    const active = shares.filter((s) => !s.revokedAt);
    return [
      { label: "Active links", value: n(active.length) },
      {
        label: "Opened",
        value: n(shares.filter((s) => s.firstOpenedAt).length),
      },
      {
        label: "Unlocked",
        value: n(shares.filter((s) => s.unlockedAt).length),
      },
      {
        label: "Downloads",
        value: n(shares.reduce((sum, s) => sum + s.downloadCount, 0)),
      },
      {
        label: "Signed up",
        value: n(shares.filter((s) => s.signedUpAt).length),
      },
      {
        label: "Credits spent",
        value: n(shares.reduce((sum, s) => sum + s.list.credits_used, 0)),
      },
    ];
  }, [shares]);

  const run = (
    fn: () => Promise<
      { ok: true; data?: unknown } | { ok: false; error: string }
    >,
    done: (data: unknown) => void,
  ) => {
    if (pending) return;
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      done("data" in res ? res.data : undefined);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-title-2-medium text-text-primary">Leads</h1>
          <p className="max-w-[720px] text-body-regular text-text-secondary">
            Sample enrichments for prospects. Each one gets a public link and a
            4-digit code to send in the chat; the lead sees the list like a
            customer and is offered 50 free credits. Lists run in the Preb
            outreach workspace and are never charged. Visible to Preb admins
            only.
          </p>
        </div>
        <ButtonLink
          href="/admin/leads/new"
          leadingIcon={RiAddLine}
          className="rounded-full"
        >
          New lead enrichment
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-1 rounded-3xl border border-border-button-default bg-background-primary-default p-4"
          >
            <span className="text-body-2-regular text-text-secondary">
              {s.label}
            </span>
            <span className="text-title-3-semibold tabular-nums text-text-primary">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-headline-medium text-text-primary">
            {visible.length} {visible.length === 1 ? "lead" : "leads"}
          </h2>
          <SegmentedControl
            aria-label="Show"
            selectedKeys={[filter]}
            onSelectionChange={(keys) => {
              const next = [...(keys as Set<string>)][0] as Filter | undefined;
              if (next) setFilter(next);
            }}
          >
            <SegmentedControlItem id="all">All</SegmentedControlItem>
            <SegmentedControlItem id="mine">Mine</SegmentedControlItem>
          </SegmentedControl>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl bg-background-secondary-default">
            <EmptyState
              size="inline"
              icon={RiUserStarLine}
              title={
                filter === "mine" ? "No leads of yours yet." : "No leads yet."
              }
              description="Create a sample enrichment and send the link with its code in the chat."
              actions={
                <ButtonLink
                  href="/admin/leads/new"
                  variant="secondary"
                  size="small"
                >
                  New lead enrichment
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <Table aria-label="Leads" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Lead</TableColumn>
              <TableColumn>Owner</TableColumn>
              <TableColumn>Enrichment</TableColumn>
              <TableColumn>Stage</TableColumn>
              <TableColumn>Link</TableColumn>
              <TableColumn>Code</TableColumn>
              <TableColumn>Created</TableColumn>
              <TableColumn className="text-end">Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {visible.map((s) => {
                const meta = LIST_STATUS_META[s.list.status];
                const url = shareUrl(s.path);
                const highlighted = s.listId === highlightListId;
                return (
                  <TableRow
                    key={s.id}
                    className={cx(
                      highlighted && "bg-background-secondary-default",
                    )}
                  >
                    <TableCell>
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-body-medium text-text-primary">
                            {s.leadName}
                          </span>
                          <ProfileLink url={s.leadLinkedinUrl} leadName={s.leadName} />
                        </span>
                        <span className="truncate text-caption-1-regular text-text-tertiary">
                          {[s.leadCompany, s.leadEmail]
                            .filter(Boolean)
                            .join(" · ") || s.list.name}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar
                          size="sm"
                          src={s.owner.imageUrl ?? undefined}
                          initials={initialsOf(s.owner.fullName)}
                          alt=""
                          color="blue"
                        />
                        <span className="text-body-2-regular text-text-primary">
                          {s.owner.firstName}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-col gap-1">
                        <Chip
                          variant="caption"
                          color={meta.chip}
                          className="w-fit"
                        >
                          {meta.label}
                        </Chip>
                        <span className="whitespace-nowrap text-caption-1-regular text-text-tertiary tabular-nums">
                          {n(s.list.processed_rows)} /{" "}
                          {n(s.list.enrichable_rows || s.list.total_rows)} ·{" "}
                          {n(s.list.credits_used)} cr
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <TooltipTrigger>
                        <span
                          tabIndex={0}
                          className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                        >
                          <Stage share={s} />
                        </span>
                        <Tooltip size="md" placement="top">
                          <EngagementTooltip share={s} />
                        </Tooltip>
                      </TooltipTrigger>
                    </TableCell>
                    <TableCell>
                      <CopyLinkCell
                        leadName={s.leadName}
                        url={url}
                        path={s.path}
                      />
                    </TableCell>
                    <TableCell>
                      <CopyCodeCell code={s.code} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-text-secondary">
                      {day(s.createdAt)}
                    </TableCell>
                    <TableCell className="text-end">
                      <span className="relative inline-flex">
                        <Dropdown
                          isOpen={menu === s.id}
                          onOpenChange={(o) => setMenu(o ? s.id : null)}
                        >
                          <DropdownTrigger
                            aria-label={`Actions for ${s.leadName}`}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-foreground-icon-primary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                          >
                            <RiMoreFill className="size-5" aria-hidden />
                          </DropdownTrigger>
                          <DropdownPopover
                            aria-label="Lead actions"
                            placement="bottom end"
                            className="w-[240px]"
                          >
                            <DropdownGroup label="Share">
                              <DropdownItem
                                onSelect={() => {
                                  setMenu(null);
                                  void menuCopy.copy(url, `${s.id}:Link`);
                                }}
                              >
                                <RiFileCopyLine
                                  className="size-5 text-foreground-icon-secondary"
                                  aria-hidden
                                />
                                <span className="text-body-medium">
                                  Copy link
                                </span>
                              </DropdownItem>
                              <DropdownItem
                                onSelect={() => {
                                  setMenu(null);
                                  void menuCopy.copy(s.code, `${s.id}:Code`);
                                }}
                              >
                                <RiFileCopyLine
                                  className="size-5 text-foreground-icon-secondary"
                                  aria-hidden
                                />
                                <span className="text-body-medium">
                                  Copy code
                                </span>
                              </DropdownItem>
                              <DropdownItem
                                onSelect={() => {
                                  setMenu(null);
                                  void menuCopy.copy(
                                    chatMessage(url, s.code),
                                    `${s.id}:Chat message`,
                                  );
                                }}
                              >
                                <RiFileCopyLine
                                  className="size-5 text-foreground-icon-secondary"
                                  aria-hidden
                                />
                                <span className="text-body-medium">
                                  Copy chat message
                                </span>
                              </DropdownItem>
                              <DropdownItem
                                onSelect={() => {
                                  setMenu(null);
                                  window.open(s.path, "_blank", "noopener");
                                }}
                              >
                                <RiExternalLinkLine
                                  className="size-5 text-foreground-icon-secondary"
                                  aria-hidden
                                />
                                <span className="text-body-medium">
                                  Open page
                                </span>
                              </DropdownItem>
                            </DropdownGroup>
                            <DropdownDivider />
                            <DropdownGroup label="Access">
                              <DropdownItem
                                onSelect={() => {
                                  setMenu(null);
                                  run(
                                    () => regenerateLeadCode(s.id),
                                    (d) =>
                                      toast.success("New code", {
                                        description: `The code for ${s.leadName} is now ${(d as { code: string }).code}.`,
                                      }),
                                  );
                                }}
                              >
                                <RiRefreshLine
                                  className="size-5 text-foreground-icon-secondary"
                                  aria-hidden
                                />
                                <span className="text-body-medium">
                                  New code
                                </span>
                              </DropdownItem>
                              <DropdownItem
                                onSelect={() => {
                                  setMenu(null);
                                  run(
                                    () => regenerateLeadLink(s.id),
                                    () =>
                                      toast.success("New link", {
                                        description:
                                          "The old link stopped working. Copy the new one from the menu.",
                                      }),
                                  );
                                }}
                              >
                                <RiRefreshLine
                                  className="size-5 text-foreground-icon-secondary"
                                  aria-hidden
                                />
                                <span className="text-body-medium">
                                  New link
                                </span>
                              </DropdownItem>
                              <DropdownItem
                                onSelect={() => {
                                  setMenu(null);
                                  run(
                                    () =>
                                      setLeadShareRevoked(s.id, !s.revokedAt),
                                    () =>
                                      toast.success(
                                        s.revokedAt
                                          ? "Link restored"
                                          : "Link revoked",
                                      ),
                                  );
                                }}
                              >
                                {s.revokedAt ? (
                                  <RiEyeLine
                                    className="size-5 text-foreground-icon-secondary"
                                    aria-hidden
                                  />
                                ) : (
                                  <RiEyeOffLine
                                    className="size-5 text-foreground-icon-secondary"
                                    aria-hidden
                                  />
                                )}
                                <span className="text-body-medium">
                                  {s.revokedAt ? "Restore link" : "Revoke link"}
                                </span>
                              </DropdownItem>
                            </DropdownGroup>
                            <DropdownDivider />
                            <DropdownGroup>
                              <DropdownItem
                                onSelect={() => {
                                  setMenu(null);
                                  setDeleting(s);
                                }}
                              >
                                <RiDeleteBinLine
                                  className="size-5 text-text-error-primary"
                                  aria-hidden
                                />
                                <span className="text-body-medium text-text-error-primary">
                                  Delete
                                </span>
                              </DropdownItem>
                            </DropdownGroup>
                          </DropdownPopover>
                        </Dropdown>
                        <CopiedBubble
                          show={
                            menuCopy.copied?.startsWith(`${s.id}:`) ?? false
                          }
                          label={
                            menuCopy.copied?.startsWith(`${s.id}:`)
                              ? `${menuCopy.copied.slice(s.id.length + 1)} copied`
                              : "Copied"
                          }
                          className="left-auto end-0 translate-x-0"
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        icon={RiDeleteBinLine}
        title={`Delete the sample for ${deleting?.leadName ?? ""}?`}
        description="The enriched list, its contacts and the link are removed for good. The lead can no longer open the page."
        confirmLabel="Delete"
        isPending={pending}
        onConfirm={() => {
          if (!deleting) return;
          const target = deleting;
          run(
            () => deleteLeadShare(target.id),
            () => {
              setDeleting(null);
              toast.success("Sample deleted");
            },
          );
        }}
      />
    </div>
  );
}
