import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RiFileList3Line } from "@remixicon/react";
import { ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { getSessionContext } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Lists" };

/** Day-1 placeholder; the dashboard (cards, toolbar, skeletons) lands on day 2. */
export default async function ListsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.profile.onboarded_at && session.role === "owner") redirect("/onboarding");

  return (
    <div className="animate-page-enter">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-2-medium text-text-primary">Lists</h1>
        <p className="text-body-regular text-text-secondary">Upload a spreadsheet and we find verified emails and phones.</p>
      </div>
      <div className="mt-8 rounded-3xl border border-border-button-default bg-background-primary-default">
        <EmptyState
          icon={RiFileList3Line}
          title="Create your first list"
          description="Upload a CSV or XLSX of candidates or hiring managers. We'll find verified work emails, personal emails and mobile numbers."
          actions={
            <ButtonLink href="/samples/contacts-template.csv" variant="secondary" download>
              Download sample CSV
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
