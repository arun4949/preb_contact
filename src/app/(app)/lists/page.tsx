import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RiAddLine, RiDownloadLine, RiFileList3Line, RiUserSearchLine } from "@remixicon/react";
import { Badge } from "@/components/base/badges/badge";
import { ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { ListCard } from "@/components/application/list-card/list-card";
import { ListsToolbar } from "@/components/application/list-card/lists-toolbar";
import { getLists, getSessionContext, getWorkspaceMembers, type ListFilters } from "@/lib/supabase/queries";
import { initialsOf } from "@/utils/initials";

export const metadata: Metadata = { title: "Lists" };

const STATUS_VALUES = ["all", "enriching", "completed", "paused"] as const;

export default async function ListsPage({ searchParams }: PageProps<"/lists">) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.profile.onboarded_at && session.role === "owner") redirect("/onboarding");

  const params = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const status = (STATUS_VALUES as readonly string[]).includes(pick(params.status)) ? (pick(params.status) as ListFilters["status"]) : "all";
  const owner = pick(params.owner) || "all";
  const q = pick(params.q);
  const filtered = status !== "all" || owner !== "all" || q.length > 0;

  const [lists, members] = await Promise.all([
    getLists(session.workspace.id, session.userId, { status, owner, q }),
    getWorkspaceMembers(session.workspace.id),
  ]);
  const ownerName = new Map(members.map((m) => [m.userId, m.fullName ?? m.email]));

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-700 text-headline-semibold text-white"
          >
            {initialsOf(session.workspace.name)}
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-title-2-medium text-text-primary">Lists</h1>
              {lists.length > 0 ? <Badge>{lists.length}</Badge> : null}
            </div>
            <p className="text-body-regular text-text-secondary">Upload a spreadsheet and we find verified emails and phones.</p>
          </div>
        </div>
        <ButtonLink href="/lists/new" leadingIcon={RiAddLine} className="rounded-full">
          New list
        </ButtonLink>
      </div>

      <ListsToolbar
        status={status ?? "all"}
        owner={owner}
        q={q}
        members={members.map((m) => ({ id: m.userId, name: m.fullName ?? m.email, isMe: m.userId === session.userId }))}
      />

      {lists.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} ownerName={ownerName.get(list.created_by) ?? null} canDelete={session.role !== "member" || list.created_by === session.userId} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-border-button-default bg-background-primary-default">
          {filtered ? (
            <EmptyState
              icon={RiFileList3Line}
              title="No lists match"
              description="Try another status, owner or search term."
              actions={
                <ButtonLink href="/lists" variant="secondary">
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={RiFileList3Line}
              title="Create your first list"
              description="Upload a CSV or XLSX of candidates or hiring managers. We'll find verified work emails, personal emails and mobile numbers."
              actions={
                <>
                  <ButtonLink href="/lists/new" leadingIcon={RiAddLine}>
                    New list
                  </ButtonLink>
                  <ButtonLink href="/enrich" variant="secondary" leadingIcon={RiUserSearchLine}>
                    Enrich a single contact
                  </ButtonLink>
                  <ButtonLink href="/samples/contacts-template.csv" variant="ghost" leadingIcon={RiDownloadLine} download>
                    Download sample CSV
                  </ButtonLink>
                </>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
