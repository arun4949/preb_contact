import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chip } from "@/components/base/badges/chip";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";
import { isAdminEmail } from "@/lib/auth/work-email";
import { getAccountCredits } from "@/lib/fullenrich/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import { minutesAgo } from "@/lib/jobs/shared";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "Ops" };
export const dynamic = "force-dynamic";

const STUCK_BATCH_MINUTES = 30;
const STALE_WEBHOOK_MINUTES = 10;

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * /admin/ops (plan § Observability): allow-listed founders only. Service-role
 * reads across all workspaces — never link to it from the product UI.
 */
export default async function OpsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();

  const admin = createAdminClient();
  const [balance, stuck, webhooks, paused, lastTick, emails, running] = await Promise.all([
    getAccountCredits().then((r) => r.balance).catch((e: unknown) => (e instanceof Error ? e.message : "unavailable")),
    admin
      .from("enrichment_batches")
      .select("id, list_id, provider, provider_enrichment_id, contact_count, attempts, submitted_at, last_polled_at")
      .eq("status", "submitted")
      .lt("submitted_at", minutesAgo(STUCK_BATCH_MINUTES))
      .order("submitted_at")
      .limit(50),
    admin
      .from("webhook_events")
      .select("id, provider, external_id, received_at, processed_at, error")
      .or(`error.not.is.null,and(processed_at.is.null,received_at.lt.${minutesAgo(STALE_WEBHOOK_MINUTES)})`)
      .order("received_at", { ascending: false })
      .limit(50),
    admin
      .from("lists")
      .select("id, name, status, workspace_id, processed_rows, total_rows, updated_at, error, workspace:workspaces(name)")
      .in("status", ["paused_credits", "paused_upstream", "failed"])
      .order("updated_at", { ascending: false })
      .limit(50),
    admin.from("provider_rate_limit").select("window_start, submit_count").limit(1).maybeSingle(),
    admin.from("email_sends").select("kind").gte("sent_at", minutesAgo(24 * 60)),
    admin.from("lists").select("id", { count: "exact", head: true }).in("status", ["queued", "enriching", "stopping"]),
  ]);

  const emailCounts = (emails.data ?? []).reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] ?? 0) + 1 }), {});
  const stats: { label: string; value: string; tone?: "warn" | "bad" }[] = [
    { label: "Provider balance (provider credits)", value: typeof balance === "number" ? balance.toLocaleString("en-US") : balance, tone: typeof balance === "number" ? (balance < 200 ? "warn" : undefined) : "bad" },
    { label: "Lists running", value: String(running.count ?? 0) },
    { label: "Stuck batches", value: String(stuck.data?.length ?? 0), tone: stuck.data?.length ? "bad" : undefined },
    { label: "Webhook problems", value: String(webhooks.data?.length ?? 0), tone: webhooks.data?.length ? "warn" : undefined },
    { label: "Paused / failed lists", value: String(paused.data?.length ?? 0), tone: paused.data?.length ? "warn" : undefined },
    { label: "Last provider call", value: lastTick.data?.window_start ? when(lastTick.data.window_start) : "never" },
  ];

  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-2-medium text-text-primary">Ops</h1>
        <p className="text-body-regular text-text-secondary">Cross-workspace health. Visible to allow-listed admins only.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-3xl border border-border-button-default bg-background-primary-default p-4">
            <span className="text-body-2-regular text-text-secondary">{s.label}</span>
            <span className={cx("text-title-3-semibold tabular-nums", s.tone === "bad" ? "text-text-error-primary" : s.tone === "warn" ? "text-status-yellow-text" : "text-text-primary")}>{s.value}</span>
          </div>
        ))}
      </div>

      <Section title={`Stuck batches (submitted > ${STUCK_BATCH_MINUTES} min, no result)`}>
        {stuck.data?.length ? (
          <Table aria-label="Stuck batches" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Batch</TableColumn>
              <TableColumn>List</TableColumn>
              <TableColumn>Provider id</TableColumn>
              <TableColumn className="text-end">Contacts</TableColumn>
              <TableColumn className="text-end">Polls</TableColumn>
              <TableColumn>Submitted</TableColumn>
              <TableColumn>Last poll</TableColumn>
            </TableHeader>
            <TableBody>
              {stuck.data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-caption-1-regular" dir="ltr">{b.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Link href={`/lists/${b.list_id}`} className="underline-offset-2 hover:underline">{b.list_id.slice(0, 8)}</Link>
                  </TableCell>
                  <TableCell className="font-mono text-caption-1-regular" dir="ltr">{b.provider}:{b.provider_enrichment_id ?? "—"}</TableCell>
                  <TableCell className="text-end tabular-nums">{b.contact_count}</TableCell>
                  <TableCell className="text-end tabular-nums">{b.attempts}</TableCell>
                  <TableCell className="whitespace-nowrap">{when(b.submitted_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{b.last_polled_at ? when(b.last_polled_at) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty text="No stuck batches." />
        )}
      </Section>

      <Section title="Webhook problems (errored, or unprocessed for 10+ min)">
        {webhooks.data?.length ? (
          <Table aria-label="Webhook problems" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Provider</TableColumn>
              <TableColumn>Event</TableColumn>
              <TableColumn>Received</TableColumn>
              <TableColumn>Processed</TableColumn>
              <TableColumn>Error</TableColumn>
            </TableHeader>
            <TableBody>
              {webhooks.data.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.provider}</TableCell>
                  <TableCell className="font-mono text-caption-1-regular" dir="ltr">{w.external_id}</TableCell>
                  <TableCell className="whitespace-nowrap">{when(w.received_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{w.processed_at ? when(w.processed_at) : <Chip variant="caption" color="yellow">pending</Chip>}</TableCell>
                  <TableCell className="max-w-[360px] truncate text-text-error-primary">{w.error ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty text="All webhooks processed." />
        )}
      </Section>

      <Section title="Paused and failed lists">
        {paused.data?.length ? (
          <Table aria-label="Paused lists" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>List</TableColumn>
              <TableColumn>Workspace</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn className="text-end">Progress</TableColumn>
              <TableColumn>Updated</TableColumn>
              <TableColumn>Error</TableColumn>
            </TableHeader>
            <TableBody>
              {paused.data.map((l) => {
                const meta = LIST_STATUS_META[l.status];
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link href={`/lists/${l.id}`} className="underline-offset-2 hover:underline">{l.name}</Link>
                    </TableCell>
                    <TableCell>{l.workspace?.name ?? l.workspace_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Chip variant="caption" color={meta.chip}>{meta.label}</Chip>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{l.processed_rows} / {l.total_rows}</TableCell>
                    <TableCell className="whitespace-nowrap">{when(l.updated_at)}</TableCell>
                    <TableCell className="max-w-[360px] truncate text-text-secondary">{l.error ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <Empty text="Nothing paused or failed." />
        )}
      </Section>

      <Section title="Emails sent in the last 24 h">
        <div className="flex flex-wrap gap-2">
          {Object.keys(emailCounts).length === 0 ? (
            <span className="text-body-2-regular text-text-tertiary">None.</span>
          ) : (
            Object.entries(emailCounts).map(([kind, n]) => (
              <Chip key={kind} variant="subtle" color="neutral">
                {kind} · {n}
              </Chip>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-headline-medium text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-background-secondary-default">
      <EmptyState size="inline" title={text} />
    </div>
  );
}
