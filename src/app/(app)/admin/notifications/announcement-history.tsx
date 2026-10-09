"use client";

import { Chip } from "@/components/base/badges/chip";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import type { AnnouncementRecord } from "@/lib/notifications/admin-actions";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const AUDIENCE_LABEL = { all: "All users", users: "Selected users", workspaces: "Workspaces" } as const;

export function AnnouncementHistory({ history }: { history: AnnouncementRecord[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-headline-medium text-text-primary">Sent announcements</h2>
      {history.length === 0 ? (
        <div className="rounded-2xl bg-background-secondary-default">
          <EmptyState size="inline" title="Nothing sent yet." description="Your first announcement will show up here with its reach and read rate." />
        </div>
      ) : (
        <Table aria-label="Sent announcements" size="sm" containerClassName="rounded-2xl">
          <TableHeader>
            <TableColumn isRowHeader>Title</TableColumn>
            <TableColumn>Audience</TableColumn>
            <TableColumn className="text-end">Recipients</TableColumn>
            <TableColumn className="text-end">Read</TableColumn>
            <TableColumn>Sent</TableColumn>
            <TableColumn>By</TableColumn>
          </TableHeader>
          <TableBody>
            {history.map((a) => {
              const rate = a.recipientCount > 0 ? Math.round((a.readCount / a.recipientCount) * 100) : 0;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body-medium text-text-primary">{a.title}</span>
                      <span className="line-clamp-1 max-w-[420px] text-caption-1-regular text-text-tertiary">{a.body}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chip variant="caption" color={a.audience === "all" ? "blue" : "soft"}>
                      {AUDIENCE_LABEL[a.audience]}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{a.recipientCount.toLocaleString("en-US")}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {a.readCount.toLocaleString("en-US")} <span className="text-text-tertiary">({rate}%)</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{when(a.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{a.createdBy}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
