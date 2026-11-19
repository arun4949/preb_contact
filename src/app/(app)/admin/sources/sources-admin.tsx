"use client";

import Link from "next/link";
import { RiCompass3Line } from "@remixicon/react";
import { Block, Card, Field, Fields, Muted, StatTile } from "@/components/application/admin-account/parts";
import { RowLinks } from "@/components/application/admin-account/row-links";
import { UrlPagination, UrlSegmented } from "@/components/application/admin-account/url-controls";
import { BarListCard } from "@/components/application/charts/bar-list-card";
import { Chip } from "@/components/base/badges/chip";
import { Banner } from "@/components/base/banner/banner";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { n, percent, plural } from "@/lib/admin/format";
import type { SourcesParams } from "@/lib/admin/signup-sources-params";
import type { SourceStats, TrackedCounts } from "@/lib/admin/signup-sources-stats";

export interface ResponseDisplayRow {
  id: string;
  name: string | null;
  email: string;
  workspace: string | null;
  team: boolean;
  /** Label of the picked option; null when the person skipped or did not respond. */
  answer: string | null;
  status: string;
  detail: string | null;
  asked: string;
}

export interface MonthDisplayRow {
  month: string;
  label: string;
  asked: number;
  answered: number;
  topSource: string | null;
}

export interface SourcesAdminProps {
  params: SourcesParams;
  error: string | null;
  stats: SourceStats;
  months: MonthDisplayRow[];
  /** Team accounts in the period, whether shown or not. */
  teamCount: number;
  responses: ResponseDisplayRow[];
  range: string;
  page: number;
  totalPages: number;
}

const PERIODS = [
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "all", label: "All time" },
];

const TEAM = [
  { id: "exclude", label: "Customers only" },
  { id: "include", label: "With team accounts" },
];

const linkClass = "rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring";

const share = (part: number, total: number) => {
  const value = percent(part, total);
  return value === null ? "—" : `${value}%`;
};

function TrackedRow({ id, label, counts, muted }: { id: string; label: string; counts: TrackedCounts; muted?: boolean }) {
  return (
    <TableRow id={id}>
      <TableCell>{muted ? <Muted>{label}</Muted> : label}</TableCell>
      <TableCell className="text-end tabular-nums">{n(counts.total)}</TableCell>
      <TableCell className="text-end tabular-nums">{n(counts.metaAdClick)}</TableCell>
      <TableCell className="text-end tabular-nums">{n(counts.referral)}</TableCell>
      <TableCell className="text-end tabular-nums">{n(counts.leadMagnet)}</TableCell>
      <TableCell className="text-end tabular-nums">{n(counts.untracked)}</TableCell>
    </TableRow>
  );
}

/** /admin/sources: response rate, channel mix, value and tracked comparison per source, every response. State lives in the URL. */
export function SourcesAdmin({ params, error, stats, months, teamCount, responses, range, page, totalPages }: SourcesAdminProps) {
  const top = stats.bySource[0] ?? null;
  const { quality } = stats;
  const otherInTopThree = stats.bySource.slice(0, 3).some((source) => source.key === "other");

  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-2-medium text-text-primary">Acquisition sources</h1>
        <p className="text-body-regular text-text-secondary">
          What new workspace owners answer when we ask how they first heard about Preb, next to what we tracked ourselves. Only owners who signed up since the question exists are asked.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <UrlSegmented aria-label="Period" param="period" value={params.period} defaultValue="90d" options={PERIODS} reset={["page"]} />
        </div>
        <div className="max-w-full overflow-x-auto">
          <UrlSegmented aria-label="Team accounts" param="team" value={params.team} defaultValue="exclude" options={TEAM} reset={["page"]} />
        </div>
        {teamCount > 0 ? (
          <span className="text-body-2-regular text-text-tertiary">
            {plural(teamCount, "team account", "team accounts")} {params.team === "include" ? "included" : "hidden"}
          </span>
        ) : null}
      </div>

      {error ? (
        <Banner tone="error" title="Acquisition sources could not be loaded">
          {error}
        </Banner>
      ) : stats.asked === 0 ? (
        <div className="rounded-3xl border border-border-button-default bg-background-primary-default">
          <EmptyState
            icon={RiCompass3Line}
            title="No one was asked in this period"
            description="New workspace owners see the question right after they create their workspace. Their answers appear here."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Asked" value={n(stats.asked)} hint="New owners" />
            <StatTile label="Answered" value={n(stats.answered)} />
            <StatTile label="Response rate" value={share(stats.answered, stats.asked)} hint="Of everyone asked" />
            <StatTile label="Skipped" value={n(stats.skipped)} hint={`${share(stats.skipped, stats.asked)} of asked`} />
            <StatTile label="No response" value={n(stats.noResponse)} hint="Left without a choice" />
            <StatTile label="Top source" value={top ? top.label : "None yet"} hint={top ? `${share(top.answers, stats.answered)} of answers` : undefined} />
          </div>

          {stats.answered === 0 ? (
            <div className="rounded-3xl border border-border-button-default bg-background-primary-default">
              <EmptyState size="inline" title="No answers in this period yet" description="Everyone asked so far skipped the question or left without answering." />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <BarListCard
                  title="Channel mix"
                  metricLabel="Share of answers"
                  items={stats.bySource.map((source) => ({ label: source.label, value: source.answers }))}
                  limit={12}
                  className="rounded-3xl"
                />
                <Card title="Answer quality" description="How far the answers can be trusted and how much they add to what we track.">
                  <Fields>
                    <Field label="Nothing tracked">
                      {n(stats.answeredTracked.untracked)} of {n(stats.answered)} answers ({share(stats.answeredTracked.untracked, stats.answered)})
                      <span className="block text-body-2-regular text-text-secondary">Accounts where the answer is all we know.</span>
                    </Field>
                    <Field label="Added a detail">
                      {n(quality.withDetail)} of {n(stats.answered)} answers ({share(quality.withDetail, stats.answered)})
                    </Field>
                    <Field label="Other">
                      {n(quality.other)} ({share(quality.other, stats.answered)})
                      {otherInTopThree ? (
                        <span className="block text-body-2-regular text-text-secondary">Among the top three answers. Read the details below and consider adding an option.</span>
                      ) : null}
                    </Field>
                    <Field label="Not sure">
                      {n(quality.notSure)} ({share(quality.notSure, stats.answered)})
                    </Field>
                    <Field label="Picked the first option shown">
                      {n(quality.firstPicked)} of {n(stats.answered)} answers ({share(quality.firstPicked, stats.answered)})
                      <span className="block text-body-2-regular text-text-secondary">
                        Chance alone would give about {share(quality.firstExpected, stats.answered)}. The order is shuffled for each person, so a clearly higher share means people pick whatever comes first.
                      </span>
                    </Field>
                  </Fields>
                </Card>
              </div>

              <Block title="Value by source" description="Paying accounts and credits spent by the workspaces behind each answer.">
                <Table aria-label="Value by source" size="sm" containerClassName="rounded-2xl">
                  <TableHeader>
                    <TableColumn isRowHeader>Source</TableColumn>
                    <TableColumn className="text-end!">Answers</TableColumn>
                    <TableColumn className="text-end!">Share</TableColumn>
                    <TableColumn className="text-end!">Paying</TableColumn>
                    <TableColumn className="text-end!">Paid conversion</TableColumn>
                    <TableColumn className="text-end!">Credits spent</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {stats.bySource.map((source) => (
                      <TableRow key={source.key} id={source.key}>
                        <TableCell>{source.label}</TableCell>
                        <TableCell className="text-end tabular-nums">{n(source.answers)}</TableCell>
                        <TableCell className="text-end tabular-nums">{share(source.answers, stats.answered)}</TableCell>
                        <TableCell className="text-end tabular-nums">{n(source.paying)}</TableCell>
                        <TableCell className="text-end tabular-nums">{share(source.paying, source.answers)}</TableCell>
                        <TableCell className="text-end tabular-nums">{n(source.creditsSpent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Block>
            </>
          )}

          <Block
            title="Self-reported and tracked"
            description="How many accounts behind each answer also carry a source we tracked. One account can count in more than one column. The Meta column needs advertising consent at signup."
          >
            <Table aria-label="Self-reported and tracked sources" size="sm" containerClassName="rounded-2xl">
              <TableHeader>
                <TableColumn isRowHeader>Answer</TableColumn>
                <TableColumn className="text-end!">Accounts</TableColumn>
                <TableColumn className="text-end!">Meta ad click</TableColumn>
                <TableColumn className="text-end!">Referral</TableColumn>
                <TableColumn className="text-end!">Lead magnet</TableColumn>
                <TableColumn className="text-end!">Nothing tracked</TableColumn>
              </TableHeader>
              <TableBody>
                {stats.tracked.map((entry) => (
                  <TrackedRow key={entry.key} id={entry.key} label={entry.label} counts={entry.counts} />
                ))}
                {stats.noAnswerTracked.total > 0 ? <TrackedRow id="no-answer" label="Skipped or no response" counts={stats.noAnswerTracked} muted /> : null}
              </TableBody>
            </Table>
          </Block>

          <Block title="By month" description="Grouped by the month the person was asked.">
            <Table aria-label="Answers by month" size="sm" containerClassName="rounded-2xl">
              <TableHeader>
                <TableColumn isRowHeader>Month</TableColumn>
                <TableColumn className="text-end!">Asked</TableColumn>
                <TableColumn className="text-end!">Answered</TableColumn>
                <TableColumn className="text-end!">Response rate</TableColumn>
                <TableColumn>Top source</TableColumn>
              </TableHeader>
              <TableBody>
                {months.map((month) => (
                  <TableRow key={month.month} id={month.month}>
                    <TableCell className="whitespace-nowrap">{month.label}</TableCell>
                    <TableCell className="text-end tabular-nums">{n(month.asked)}</TableCell>
                    <TableCell className="text-end tabular-nums">{n(month.answered)}</TableCell>
                    <TableCell className="text-end tabular-nums">{share(month.answered, month.asked)}</TableCell>
                    <TableCell>{month.topSource ?? <Muted>—</Muted>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Block>

          <Block title="Responses" description="Everyone asked in this period, newest first. A row opens the account.">
            <div className="flex flex-col gap-4">
              <RowLinks base="/admin/users">
                <Table aria-label="Responses" size="sm" containerClassName="rounded-2xl">
                  <TableHeader>
                    <TableColumn isRowHeader>Name</TableColumn>
                    <TableColumn>Email</TableColumn>
                    <TableColumn>Workspace</TableColumn>
                    <TableColumn>Answer</TableColumn>
                    <TableColumn>Detail</TableColumn>
                    <TableColumn>Asked</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {responses.map((row) => (
                      <TableRow key={row.id} id={row.id}>
                        <TableCell className="whitespace-nowrap">
                          <Link href={`/admin/users/${row.id}`} className={linkClass}>
                            {row.name ?? <Muted>No name</Muted>}
                          </Link>
                        </TableCell>
                        <TableCell dir="ltr">{row.email}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            {row.workspace ?? <Muted>—</Muted>}
                            {row.team ? (
                              <Chip variant="caption" color="neutral">
                                Team
                              </Chip>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>
                          {row.answer ? (
                            <Chip variant="caption" color="blue">
                              {row.answer}
                            </Chip>
                          ) : (
                            <Muted>{row.status}</Muted>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          {row.detail ? (
                            <bdi className="block truncate" title={row.detail}>
                              {row.detail}
                            </bdi>
                          ) : (
                            <Muted>—</Muted>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.asked}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RowLinks>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-body-2-regular text-text-secondary tabular-nums">{range}</span>
                <UrlPagination aria-label="Responses pages" param="page" page={page} totalPages={totalPages} />
              </div>
            </div>
          </Block>
        </>
      )}
    </div>
  );
}
