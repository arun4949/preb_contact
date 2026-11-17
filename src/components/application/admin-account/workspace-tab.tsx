import Link from "next/link";
import { Chip } from "@/components/base/badges/chip";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import type { AccountDetail } from "@/lib/admin/accounts";
import { day } from "@/lib/admin/format";
import { Block, Card, Field, Fields, Muted, Nothing, PartError, humanize } from "./parts";

const linkClass = "rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring";

/** The workspace this account works in: basics, members (each links to their own page), open invites. */
export function WorkspaceTab({ detail }: { detail: AccountDetail }) {
  const { workspace, members, invites, person } = detail;
  if (!workspace) return <Nothing text="This account is not a member of any workspace." />;

  return (
    <>
      <Card title="Workspace">
        <Fields>
          <Field label="Name">{workspace.name}</Field>
          <Field label="Type">
            {workspace.kind === "internal" ? (
              <Chip variant="caption" color="purple">
                Internal, never charged
              </Chip>
            ) : (
              "Customer"
            )}
          </Field>
          <Field label="Created">{day(workspace.created_at)}</Field>
          <Field label="Workspace id">
            <span className="font-mono text-caption-1-regular" dir="ltr">
              {workspace.id}
            </span>
          </Field>
        </Fields>
      </Card>

      <Block title="Members" description="Everyone in this workspace shares its credits and lists.">
        {members.error !== null ? (
          <PartError title="Members could not be loaded" error={members.error} />
        ) : members.data.length === 0 ? (
          <Nothing text="This workspace has no members." />
        ) : (
          <Table aria-label="Members" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Name</TableColumn>
              <TableColumn>Email</TableColumn>
              <TableColumn>Role</TableColumn>
              <TableColumn>Joined</TableColumn>
            </TableHeader>
            <TableBody>
              {members.data.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell className="whitespace-nowrap">
                    {member.userId === person.id ? (
                      <span className="flex items-center gap-2">
                        {member.fullName ?? <Muted>Not onboarded</Muted>}
                        <Chip variant="caption" color="soft">
                          This account
                        </Chip>
                      </span>
                    ) : (
                      <Link href={`/admin/users/${member.userId}`} className={linkClass}>
                        {member.fullName ?? <Muted>Not onboarded</Muted>}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell dir="ltr">{member.email || "—"}</TableCell>
                  <TableCell>{humanize(member.role)}</TableCell>
                  <TableCell className="whitespace-nowrap">{day(member.joinedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Block>

      <Block title="Open invites" description="Invitations that were sent and not accepted yet.">
        {invites.error !== null ? (
          <PartError title="Invites could not be loaded" error={invites.error} />
        ) : invites.data.length === 0 ? (
          <Nothing text="No open invites." />
        ) : (
          <Table aria-label="Open invites" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Email</TableColumn>
              <TableColumn>Role</TableColumn>
              <TableColumn>Sent</TableColumn>
              <TableColumn>Expires</TableColumn>
            </TableHeader>
            <TableBody>
              {invites.data.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell dir="ltr">{invite.email}</TableCell>
                  <TableCell>{humanize(invite.role)}</TableCell>
                  <TableCell className="whitespace-nowrap">{day(invite.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{day(invite.expiresAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Block>
    </>
  );
}
