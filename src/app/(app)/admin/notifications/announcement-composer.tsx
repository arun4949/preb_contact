"use client";

import { useMemo, useState, useTransition } from "react";
import { RiMegaphoneLine, RiSearchLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Chip } from "@/components/base/badges/chip";
import { ConfirmDialog } from "@/components/base/dialog/dialog";
import { Input } from "@/components/base/input/input";
import { ScrollFade } from "@/components/base/scroll-fade/scroll-fade";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Textarea } from "@/components/base/textarea/textarea";
import { useToast } from "@/components/base/toast/toast";
import { NotificationRow } from "@/components/application/notification-center/notification-center";
import { sendAnnouncement, type AnnouncementRecipients } from "@/lib/notifications/admin-actions";
import { BODY_MAX, TITLE_MAX, validateAnnouncement, type AnnouncementAudience } from "@/lib/notifications/announcement";
import type { NotificationItem } from "@/lib/notifications/types";
import { initialsOf } from "@/utils/initials";
import { cx } from "@/utils/cx";

const AUDIENCES: { id: AnnouncementAudience; label: string }[] = [
  { id: "all", label: "All users" },
  { id: "users", label: "Selected users" },
  { id: "workspaces", label: "Workspaces" },
];

function Card({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("flex flex-col gap-5 rounded-3xl border border-border-button-default bg-background-primary-default p-5 md:p-6", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-headline-medium text-text-primary">{title}</h2>
        {subtitle ? <p className="text-body-2-regular text-text-secondary">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AnnouncementComposer({ recipients, onSent }: { recipients: AnnouncementRecipients; onSent: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const input = { title, body, href, audience, targetIds: audience === "all" ? [] : [...picked] };
  const problem = validateAnnouncement(input);

  const reach = useMemo(() => {
    if (audience === "all") return recipients.users.length;
    if (audience === "users") return picked.size;
    return recipients.workspaces.filter((w) => picked.has(w.id)).reduce((sum, w) => sum + w.memberCount, 0);
  }, [audience, picked, recipients]);

  const q = search.trim().toLowerCase();
  const users = recipients.users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.workspaceName ?? "").toLowerCase().includes(q));
  const workspaces = recipients.workspaces.filter((w) => !q || w.name.toLowerCase().includes(q));

  const toggle = (id: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const preview: NotificationItem = {
    id: "preview",
    kind: "admin",
    category: "announcement",
    title: title.trim() || "Your title",
    body: body.trim() || "Your message appears here, exactly as users will read it in the bell.",
    href: href.trim() || null,
    status: "information",
    createdAt: "",
    readAt: null,
  };

  const send = () =>
    start(async () => {
      const res = await sendAnnouncement(input);
      setConfirm(false);
      if (res.ok) {
        toast.success(`Announcement sent to ${res.data.recipients.toLocaleString("en-US")} ${res.data.recipients === 1 ? "user" : "users"}`);
        setTitle("");
        setBody("");
        setHref("");
        setAudience("all");
        setPicked(new Set());
        onSent();
      } else {
        toast.error(res.error);
      }
    });

  const reachLabel = `${reach.toLocaleString("en-US")} ${reach === 1 ? "user" : "users"}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <Card title="New announcement" subtitle="Keep it short. The title is what people see first.">
        <div className="flex flex-col gap-4">
          <Input label="Title" value={title} onChange={setTitle} maxLength={TITLE_MAX} placeholder="New: enrich a single contact from the Enrich tab" hint={`${title.length}/${TITLE_MAX}`} />
          <Textarea label="Message" value={body} onChange={setBody} maxLength={BODY_MAX} showCount rows={4} placeholder="What changed, why it matters, what to do next." />
          <Input label="Link (optional)" value={href} onChange={setHref} placeholder="/enrich or https://..." inputDir="ltr" hint="A path inside the app or an https link." />
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-body-2-medium text-text-secondary">Audience</span>
          <SegmentedControl
            aria-label="Audience"
            selectedKeys={[audience]}
            onSelectionChange={(keys) => {
              const next = [...(keys as Set<string>)][0] as AnnouncementAudience | undefined;
              if (!next) return;
              setAudience(next);
              setPicked(new Set());
              setSearch("");
            }}
            className="flex w-full"
          >
            {AUDIENCES.map((a) => (
              <SegmentedControlItem key={a.id} id={a.id} className="flex-1">
                {a.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>

          {audience !== "all" ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default p-3">
              <div className="flex items-center gap-3">
                <Input aria-label={audience === "users" ? "Search users" : "Search workspaces"} value={search} onChange={setSearch} placeholder={audience === "users" ? "Search by name, email or workspace" : "Search workspaces"} leadingIcon={RiSearchLine} size="small" className="flex-1" />
                <span className="text-body-2-regular whitespace-nowrap text-text-secondary">{picked.size} selected</span>
                {picked.size > 0 ? (
                  <Button variant="ghost" size="small" onClick={() => setPicked(new Set())}>
                    Clear
                  </Button>
                ) : null}
              </div>
              <ScrollFade className="max-h-72 rounded-xl bg-background-primary-default p-1" surfaceClassName="from-background-primary-default">
                {audience === "users" ? (
                  users.length === 0 ? (
                    <p className="p-3 text-body-2-regular text-text-tertiary">No users match.</p>
                  ) : (
                    <ul className="flex flex-col">
                      {users.map((u) => (
                        <li key={u.id}>
                          <Checkbox isSelected={picked.has(u.id)} onChange={(on) => toggle(u.id, on)} className="w-full rounded-lg px-2 py-1.5 hover:bg-background-secondary-hover">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <Avatar size="sm" initials={initialsOf(u.name)} alt="" color="blue" />
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate text-body-2-medium text-text-primary">{u.name}</span>
                                <span className="truncate text-caption-1-regular text-text-tertiary" dir="ltr">
                                  {u.email}
                                </span>
                              </span>
                              {u.workspaceName ? (
                                <Chip variant="caption" color="soft" className="ms-auto hidden shrink-0 sm:inline-flex">
                                  {u.workspaceName}
                                </Chip>
                              ) : null}
                            </span>
                          </Checkbox>
                        </li>
                      ))}
                    </ul>
                  )
                ) : workspaces.length === 0 ? (
                  <p className="p-3 text-body-2-regular text-text-tertiary">No workspaces match.</p>
                ) : (
                  <ul className="flex flex-col">
                    {workspaces.map((w) => (
                      <li key={w.id}>
                        <Checkbox isSelected={picked.has(w.id)} onChange={(on) => toggle(w.id, on)} className="w-full rounded-lg px-2 py-1.5 hover:bg-background-secondary-hover">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="truncate text-body-2-medium text-text-primary">{w.name}</span>
                            <span className="ms-auto shrink-0 text-caption-1-regular text-text-tertiary">
                              {w.memberCount} {w.memberCount === 1 ? "member" : "members"}
                            </span>
                          </span>
                        </Checkbox>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollFade>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator-border pt-4">
          <span className="text-body-2-regular text-text-secondary">{problem && (title || body) ? problem : `Will reach ${reachLabel}.`}</span>
          <Button leadingIcon={RiMegaphoneLine} disabled={problem !== null || pending} onClick={() => setConfirm(true)}>
            {reach > 0 ? `Send to ${reachLabel}` : "Send"}
          </Button>
        </div>
      </Card>

      <Card title="Preview" subtitle="How the row looks in the notification bell." className="h-fit">
        <div className="rounded-2xl bg-background-secondary-default p-2">
          <NotificationRow item={preview} timeLabel="now" />
        </div>
        <p className="text-caption-1-regular text-text-tertiary">Announcements show the Preb mark, land under the Announcements tab and count as unread until opened.</p>
      </Card>

      <ConfirmDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title="Send this announcement?"
        description={`It reaches ${reachLabel} right away and cannot be recalled.`}
        confirmLabel={pending ? "Sending…" : "Send"}
        tone="primary"
        icon={RiMegaphoneLine}
        isPending={pending}
        onConfirm={send}
      >
        <span className="text-body-medium text-text-primary">{title.trim()}</span>
      </ConfirmDialog>
    </div>
  );
}
