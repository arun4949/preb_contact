"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiMailSendLine, RiTeamLine, RiUserUnfollowLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { ConfirmDialog } from "@/components/base/dialog/dialog";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { useToast } from "@/components/base/toast/toast";
import {
  changeMemberRole,
  fetchMembers,
  inviteMember,
  removeMember,
  resendInvite,
  revokeInvite,
  type InviteRole,
  type MembersOverview,
} from "@/lib/workspace/actions";
import type { WorkspaceMember } from "@/lib/supabase/queries";
import { initialsOf } from "@/utils/initials";
import { cx } from "@/utils/cx";
import { SettingsCard, SettingsSectionLabel } from "./settings-rows";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" };
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Settings › Members (plan § 6, screens § 6 "Workspace"): members list with
 * role select + remove, invite row, pending invites with Resend / Revoke.
 * Members (non-admins) see the list read-only and may leave the workspace.
 */
export function SettingsMembers() {
  const [data, setData] = useState<MembersOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [confirm, setConfirm] = useState<{ kind: "remove" | "leave" | "revoke"; id: string; label: string } | null>(null);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const load = useCallback(() => {
    fetchMembers()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Could not load members."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = (id: string | null, fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      setBusyId(id);
      const res = await fn();
      setBusyId(null);
      if (res.ok) {
        toast.success(success);
        after?.();
        load();
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });

  const sendInvite = () => {
    const value = email.trim();
    if (!value) return;
    run("invite", () => inviteMember(value, role), `Invite sent to ${value.toLowerCase()}`, () => setEmail(""));
  };

  if (error) {
    return <EmptyState size="inline" icon={RiTeamLine} title="Members unavailable" description={error} actions={<Button variant="secondary" onClick={load}>Retry</Button>} />;
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-[180px] w-full rounded-2xl" />
      </div>
    );
  }

  const confirmCopy = confirm
    ? confirm.kind === "leave"
      ? { title: "Leave this workspace?", description: `You'll lose access to ${data.workspaceName}'s lists and credits. An admin can invite you again.`, label: "Leave workspace" }
      : confirm.kind === "remove"
        ? { title: `Remove ${confirm.label}?`, description: "They lose access to this workspace immediately. Lists they created stay in the workspace.", label: "Remove member" }
        : { title: "Revoke this invite?", description: `The link sent to ${confirm.label} stops working.`, label: "Revoke invite" }
    : null;

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Invite row */}
      {data.canManage ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            sendInvite();
          }}
        >
          <Input
            label="Invite a teammate"
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={setEmail}
            inputDir="ltr"
            className="min-w-0 flex-1"
            isDisabled={pending && busyId === "invite"}
          />
          <div className="flex items-center gap-2">
            <Select aria-label="Role" selectedKey={role} onSelectionChange={(k) => setRole(k as InviteRole)} triggerClassName="w-[104px] shrink-0 sm:w-[120px]" popoverClassName="w-[200px]">
              <SelectItem id="member">Member</SelectItem>
              <SelectItem id="admin">Admin</SelectItem>
            </Select>
            <Button type="submit" leadingIcon={RiMailSendLine} className="flex-1 sm:flex-none" disabled={!email.trim() || (pending && busyId === "invite")}>
              {pending && busyId === "invite" ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-body-2-regular text-text-tertiary">Only workspace owners and admins can invite teammates or change roles.</p>
      )}

      {/* Members */}
      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>
          {data.members.length} {data.members.length === 1 ? "member" : "members"}
        </SettingsSectionLabel>
        <SettingsCard>
          {data.members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isMe={m.userId === data.me}
              canManage={data.canManage}
              busy={pending && busyId === m.userId}
              onRoleChange={(next) => run(m.userId, () => changeMemberRole(m.userId, next), `${m.fullName ?? m.email} is now ${ROLE_LABEL[next].toLowerCase()}`)}
              onRemove={() => setConfirm({ kind: m.userId === data.me ? "leave" : "remove", id: m.userId, label: m.fullName ?? m.email })}
            />
          ))}
        </SettingsCard>
      </div>

      {/* Pending invites */}
      {data.canManage ? (
        <div className="flex w-full flex-col gap-2">
          <SettingsSectionLabel>Pending invites</SettingsSectionLabel>
          {data.invites.length === 0 ? (
            <div className="rounded-2xl bg-background-secondary-default">
              <EmptyState size="inline" icon={RiMailSendLine} title="No pending invites" description="Invited teammates appear here until they join." />
            </div>
          ) : (
            <SettingsCard>
              {data.invites.map((inv) => {
                const busy = pending && busyId === inv.id;
                return (
                  <div key={inv.id} className="flex min-h-[52px] w-full flex-wrap items-center justify-between gap-3 border-b border-separator-border py-2.5 pe-2.5 last:border-b-0">
                    <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
                      <Avatar size="sm" alt="" initials={initialsOf(inv.email)} color="neutral" />
                      <div className="flex min-w-0 flex-col">
                        <p className="truncate text-body-regular text-text-primary" dir="ltr">
                          {inv.email}
                        </p>
                        <p className="text-body-2-regular text-text-secondary">
                          {ROLE_LABEL[inv.role]} · {inv.expired ? "expired" : `expires ${date(inv.expiresAt)}`}
                        </p>
                      </div>
                      {inv.expired ? (
                        <Chip variant="caption" color="yellow">
                          Expired
                        </Chip>
                      ) : null}
                    </div>
                    <div className="ms-auto flex shrink-0 items-center gap-1">
                      <Button variant="secondary" size="small" disabled={busy} onClick={() => run(inv.id, () => resendInvite(inv.id), `Invite re-sent to ${inv.email}`)}>
                        {busy ? "Sending…" : "Resend"}
                      </Button>
                      <Button variant="secondary" size="small" disabled={busy} onClick={() => setConfirm({ kind: "revoke", id: inv.id, label: inv.email })}>
                        Revoke
                      </Button>
                    </div>
                  </div>
                );
              })}
            </SettingsCard>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        icon={RiUserUnfollowLine}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.description}
        confirmLabel={confirmCopy?.label}
        isPending={pending}
        onConfirm={() => {
          if (!confirm) return;
          const c = confirm;
          if (c.kind === "revoke") {
            run(c.id, () => revokeInvite(c.id), "Invite revoked", () => setConfirm(null));
          } else {
            start(async () => {
              const res = await removeMember(c.id);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              setConfirm(null);
              if (res.data.left) {
                toast.success("You left the workspace");
                router.push("/lists");
                router.refresh();
              } else {
                toast.success(`${c.label} was removed`);
                load();
                router.refresh();
              }
            });
          }
        }}
      />
    </div>
  );
}

function MemberRow({
  member,
  isMe,
  canManage,
  busy,
  onRoleChange,
  onRemove,
}: {
  member: WorkspaceMember;
  isMe: boolean;
  canManage: boolean;
  busy: boolean;
  onRoleChange: (role: InviteRole) => void;
  onRemove: () => void;
}) {
  const name = member.fullName ?? member.email;
  const isOwner = member.role === "owner";
  const editable = canManage && !isOwner && !isMe;
  const removable = editable || (isMe && !isOwner);
  return (
    <div className={cx("flex min-h-[52px] w-full flex-wrap items-center justify-between gap-3 border-b border-separator-border py-2.5 pe-2.5 last:border-b-0", busy && "opacity-60")}>
      <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
        <Avatar size="sm" src={member.avatarUrl ?? undefined} alt="" initials={initialsOf(name)} color={isOwner ? "blue" : "neutral"} />
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-body-regular text-text-primary">
            {name}
            {isMe ? <span className="text-text-tertiary"> · you</span> : null}
          </p>
          <p className="truncate text-body-2-regular text-text-secondary" dir="ltr">
            {member.email}
          </p>
        </div>
      </div>
      <div className="ms-auto flex shrink-0 items-center gap-1">
        {editable ? (
          <Select aria-label={`Role of ${name}`} size="sm" selectedKey={member.role} isDisabled={busy} onSelectionChange={(k) => k !== member.role && onRoleChange(k as InviteRole)} triggerClassName="w-[104px]" popoverClassName="w-[180px]">
            <SelectItem id="member">Member</SelectItem>
            <SelectItem id="admin">Admin</SelectItem>
          </Select>
        ) : (
          <Chip variant="caption" color={isOwner ? "blue" : "neutral"}>
            {ROLE_LABEL[member.role]}
          </Chip>
        )}
        {removable ? (
          <Button variant="secondary" size="small" disabled={busy} onClick={onRemove}>
            {isMe ? "Leave" : "Remove"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
