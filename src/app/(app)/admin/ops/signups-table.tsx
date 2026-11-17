"use client";

import Link from "next/link";
import { Chip } from "@/components/base/badges/chip";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { RowLinks } from "@/components/application/admin-account/row-links";
import { n } from "@/lib/admin/format";

type ChipColor = "lime" | "blue" | "neutral";

/** Plain, already formatted values: dates are formatted on the server so both renders match. */
export interface SignupRow {
  id: string;
  name: string | null;
  email: string;
  workspace: string | null;
  stage: { label: string; color: ChipColor };
  plan: { label: string; color: ChipColor };
  /** Null when the spend lookup failed (the page shows the error banner). */
  creditsSpent: number | null;
  created: string;
  phone: { href: string; label: string; callsAllowed: boolean } | null;
}

/** Recent signups on /admin/ops. A row opens the account page; the name is a real link for keyboard use and new tabs. */
export function SignupsTable({ rows }: { rows: SignupRow[] }) {
  return (
    <RowLinks base="/admin/users">
      <Table aria-label="Recent signups" size="sm" containerClassName="rounded-2xl">
        <TableHeader>
          <TableColumn isRowHeader>Name</TableColumn>
          <TableColumn>Email</TableColumn>
          <TableColumn>Workspace</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Plan</TableColumn>
          <TableColumn className="text-end">Credits spent</TableColumn>
          <TableColumn>Created</TableColumn>
          <TableColumn>Phone</TableColumn>
          <TableColumn>Calls</TableColumn>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id} id={u.id} className="cursor-pointer hover:bg-background-secondary-default">
              <TableCell className="whitespace-nowrap">
                <Link href={`/admin/users/${u.id}`} className="rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                  {u.name ?? <span className="text-text-tertiary">Not onboarded</span>}
                </Link>
              </TableCell>
              <TableCell dir="ltr">{u.email}</TableCell>
              <TableCell className="max-w-[220px] truncate">{u.workspace ?? "—"}</TableCell>
              <TableCell>
                <Chip variant="caption" color={u.stage.color}>
                  {u.stage.label}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip variant="caption" color={u.plan.color}>
                  {u.plan.label}
                </Chip>
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {u.creditsSpent === null ? <span className="text-text-tertiary">—</span> : u.creditsSpent === 0 ? <span className="text-text-tertiary">0</span> : n(u.creditsSpent)}
              </TableCell>
              <TableCell className="whitespace-nowrap">{u.created}</TableCell>
              <TableCell className="whitespace-nowrap" dir="ltr">
                {u.phone ? (
                  <a href={u.phone.href} className="tabular-nums underline-offset-2 hover:underline">
                    {u.phone.label}
                  </a>
                ) : (
                  <span className="text-text-tertiary">—</span>
                )}
              </TableCell>
              <TableCell>
                {u.phone ? (
                  <Chip variant="caption" color={u.phone.callsAllowed ? "lime" : "neutral"}>
                    {u.phone.callsAllowed ? "Call ok" : "Opted out"}
                  </Chip>
                ) : (
                  <span className="text-body-2-regular text-text-tertiary">No phone</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </RowLinks>
  );
}
