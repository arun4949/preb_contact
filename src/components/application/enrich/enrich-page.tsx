"use client";

import type { ManualHistory, ManualRunState } from "@/lib/enrich/queries";
import { EnrichedContactsTable } from "./enriched-contacts-table";
import { ManualEnrichForm } from "./manual-enrich-form";
import type { OverspendStart } from "@/lib/billing/queries";

export interface EnrichPageProps {
  creditsAvailable: number;
  overspend: OverspendStart;
  history: ManualHistory;
  runState: ManualRunState;
  q: string;
  workspaceId: string;
}

/** Enrich tab: the manual form on top, the history of every manual result below. */
export function EnrichPage({ creditsAvailable, overspend, history, runState, q, workspaceId }: EnrichPageProps) {
  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex flex-col">
        <h1 className="text-title-2-medium text-text-primary">Enrich contacts</h1>
        <p className="text-body-regular text-text-secondary">Find verified emails and mobile numbers for individual people, no spreadsheet needed.</p>
      </div>
      <ManualEnrichForm creditsAvailable={creditsAvailable} overspend={overspend} />
      <EnrichedContactsTable history={history} runState={runState} q={q} workspaceId={workspaceId} />
    </div>
  );
}
