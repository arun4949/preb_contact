"use client";

import Link from "next/link";
import { RiStackLine } from "@remixicon/react";
import { Block, Card, Field, Fields, Muted, StatTile } from "@/components/application/admin-account/parts";
import { RowLinks } from "@/components/application/admin-account/row-links";
import { UrlPagination } from "@/components/application/admin-account/url-controls";
import { BarListCard } from "@/components/application/charts/bar-list-card";
import { Chip } from "@/components/base/badges/chip";
import { Banner } from "@/components/base/banner/banner";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { n, percent } from "@/lib/admin/format";
import type { AtsStats } from "@/lib/admin/signup-ats-stats";
import type { ResponseDisplayRow } from "./sources-view";

export interface AtsMonthDisplayRow {
  month: string;
  label: string;
  asked: number;
  answered: number;
  topAts: string | null;
}

export interface AtsViewProps {
  error: string | null;
  stats: AtsStats;
  months: AtsMonthDisplayRow[];
  responses: ResponseDisplayRow[];
  range: string;
  page: number;
  totalPages: number;
}

const linkClass = "rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring";

const share = (part: number, total: number) => {
  const value = percent(part, total);
  return value === null ? "—" : `${value}%`;
};

/** ATS view of /admin/insights: response rate, the mix of systems, value per system, every response. */
export function AtsView({ error, stats, months, responses, range, page, totalPages }: AtsViewProps) {
  const top = stats.byAts[0] ?? null;
  const { quality } = stats;
  const otherInTopThree = stats.byAts.slice(0, 3).some((entry) => entry.key === "other");

  return (
    <>
      {error ? (
        <Banner tone="error" title="ATS answers could not be loaded">
          {error}
        </Banner>
      ) : stats.asked === 0 ? (
        <div className="rounded-3xl border border-border-button-default bg-background-primary-default">
          <EmptyState
            icon={RiStackLine}
            title="No one was asked in this period"
            description="New workspace owners see the question right after they say how they found Preb. Their answers appear here."
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
            <StatTile label="Top ATS" value={top ? top.label : "None yet"} hint={top ? `${share(top.answers, stats.answered)} of answers` : undefined} />
          </div>

          {stats.answered === 0 ? (
            <div className="rounded-3xl border border-border-button-default bg-background-primary-default">
              <EmptyState size="inline" title="No answers in this period yet" description="Everyone asked so far skipped the question or left without answering." />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <BarListCard
                  title="ATS mix"
                  metricLabel="Share of answers"
                  items={stats.byAts.map((entry) => ({ label: entry.label, value: entry.answers }))}
                  limit={12}
                  className="rounded-3xl"
                />
                <Card title="Answer quality" description="How many teams work with an ATS and how well the list of options covers them.">
                  <Fields>
                    <Field label="Uses an ATS">
                      {n(quality.usesAts)} of {n(stats.answered)} answers ({share(quality.usesAts, stats.answered)})
                      <span className="block text-body-2-regular text-text-secondary">A listed system or one named under Other.</span>
                    </Field>
                    <Field label="No ATS">
                      {n(quality.none)} ({share(quality.none, stats.answered)})
                      <span className="block text-body-2-regular text-text-secondary">Teams that work from a spreadsheet or a CRM.</span>
                    </Field>
                    <Field label="Other">
                      {n(quality.other)} ({share(quality.other, stats.answered)})
                      {otherInTopThree ? (
                        <span className="block text-body-2-regular text-text-secondary">Among the top three answers. Read the details below and consider adding an option.</span>
                      ) : null}
                    </Field>
                    <Field label="Named their system under Other">
                      {n(quality.otherWithDetail)} of {n(quality.other)} ({share(quality.otherWithDetail, quality.other)})
                    </Field>
                  </Fields>
                </Card>
              </div>

              <Block title="Value by ATS" description="Paying accounts and credits spent by the workspaces behind each answer.">
                <Table aria-label="Value by ATS" size="sm" containerClassName="rounded-2xl">
                  <TableHeader>
                    <TableColumn isRowHeader>ATS</TableColumn>
                    <TableColumn className="text-end!">Answers</TableColumn>
                    <TableColumn className="text-end!">Share</TableColumn>
                    <TableColumn className="text-end!">Paying</TableColumn>
                    <TableColumn className="text-end!">Paid conversion</TableColumn>
                    <TableColumn className="text-end!">Credits spent</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {stats.byAts.map((entry) => (
                      <TableRow key={entry.key} id={entry.key}>
                        <TableCell>{entry.label}</TableCell>
                        <TableCell className="text-end tabular-nums">{n(entry.answers)}</TableCell>
                        <TableCell className="text-end tabular-nums">{share(entry.answers, stats.answered)}</TableCell>
                        <TableCell className="text-end tabular-nums">{n(entry.paying)}</TableCell>
                        <TableCell className="text-end tabular-nums">{share(entry.paying, entry.answers)}</TableCell>
                        <TableCell className="text-end tabular-nums">{n(entry.creditsSpent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Block>
            </>
          )}

          <Block title="By month" description="Grouped by the month the person was asked.">
            <Table aria-label="ATS answers by month" size="sm" containerClassName="rounded-2xl">
              <TableHeader>
                <TableColumn isRowHeader>Month</TableColumn>
                <TableColumn className="text-end!">Asked</TableColumn>
                <TableColumn className="text-end!">Answered</TableColumn>
                <TableColumn className="text-end!">Response rate</TableColumn>
                <TableColumn>Top ATS</TableColumn>
              </TableHeader>
              <TableBody>
                {months.map((month) => (
                  <TableRow key={month.month} id={month.month}>
                    <TableCell className="whitespace-nowrap">{month.label}</TableCell>
                    <TableCell className="text-end tabular-nums">{n(month.asked)}</TableCell>
                    <TableCell className="text-end tabular-nums">{n(month.answered)}</TableCell>
                    <TableCell className="text-end tabular-nums">{share(month.answered, month.asked)}</TableCell>
                    <TableCell>{month.topAts ?? <Muted>—</Muted>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Block>

          <Block title="Responses" description="Everyone asked in this period, newest first. A row opens the account.">
            <div className="flex flex-col gap-4">
              <RowLinks base="/admin/users">
                <Table aria-label="ATS responses" size="sm" containerClassName="rounded-2xl">
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
                <UrlPagination aria-label="ATS responses pages" param="page" page={page} totalPages={totalPages} />
              </div>
            </div>
          </Block>
        </>
      )}
    </>
  );
}
