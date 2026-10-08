"use client";

import { useRouter } from "next/navigation";
import type { ManualHistory, ManualRunState } from "@/lib/enrich/queries";
import { EnrichedContactsTable } from "./enriched-contacts-table";
import { ManualEnrichForm } from "./manual-enrich-form";

export interface EnrichPageProps {
  creditsAvailable: number;
  history: ManualHistory;
  runState: ManualRunState;
  q: string;
  workspaceId: string;
}

/** Enrich tab: the manual form on top, the history of every manual result below. */
export function EnrichPage({ creditsAvailable, history, runState, q, workspaceId }: EnrichPageProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex flex-col">
        <h1 className="text-title-2-medium text-text-primary">Enrich contacts</h1>
        <p className="text-body-regular text-text-secondary">Find verified emails and mobile numbers for individual people, no spreadsheet needed.</p>
      </div>
      <ManualEnrichForm creditsAvailable={creditsAvailable} onStarted={() => router.refresh()} />
      <EnrichedContactsTable history={history} runState={runState} q={q} workspaceId={workspaceId} />
    </div>
  );
}
