import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RiArrowLeftLine } from "@remixicon/react";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { ButtonLink } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { getSessionContext } from "@/lib/supabase/queries";
import { createClient } from "@/utils/supabase/server";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";

export const metadata: Metadata = { title: "List" };

/**
 * Day-2 placeholder so `startList` has somewhere to land. The enriching view
 * (progress panel) and the completed table arrive on day 4.
 */
export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  const { id } = await params;
  const supabase = await createClient();
  const { data: list } = await supabase.from("lists").select("*").eq("id", id).maybeSingle();
  if (!list) notFound();
  const meta = LIST_STATUS_META[list.status];

  const stats: [string, number][] = [
    ["Rows", list.total_rows],
    ["Enrichable", list.enrichable_rows],
    ["Processed", list.processed_rows],
    ["Valid emails", list.found_work_email],
    ["Risky emails", list.risky_email],
    ["Mobile phones", list.found_phone],
    ["Already enriched (free)", list.cached_rows],
    ["Credits reserved", list.credits_estimated],
  ];

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Breadcrumb>
            <BreadcrumbItem href="/lists">Lists</BreadcrumbItem>
            <BreadcrumbItem current>{list.name}</BreadcrumbItem>
          </Breadcrumb>
          <div className="flex items-center gap-3">
            <h1 className="text-title-2-medium text-text-primary">{list.name}</h1>
            <Chip variant="caption" color={meta.chip}>
              {meta.label}
            </Chip>
          </div>
        </div>
        <ButtonLink href="/lists" variant="secondary" leadingIcon={RiArrowLeftLine}>
          Back to lists
        </ButtonLink>
      </div>

      <div className="rounded-3xl border border-border-button-default bg-background-primary-default p-6">
        <p className="text-headline-medium text-text-primary">Enrichment is queued</p>
        <p className="mt-1 text-body-regular text-text-secondary">
          The background engine and the live results table are the next two sprint days. Your rows and credit reservation are stored.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 rounded-2xl bg-background-secondary-default px-4 py-3">
              <dt className="text-body-2-regular text-text-tertiary">{label}</dt>
              <dd className="text-title-3-semibold text-text-primary tabular-nums">{value.toLocaleString("en-US")}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
