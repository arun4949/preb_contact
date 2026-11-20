"use client";

import type { ReactNode } from "react";
import { UrlSegmented } from "@/components/application/admin-account/url-controls";
import { plural } from "@/lib/admin/format";
import type { InsightView, SourcesParams } from "@/lib/admin/signup-sources-params";

const VIEWS: { id: InsightView; label: string }[] = [
  { id: "sources", label: "Sources" },
  { id: "ats", label: "ATS" },
];

const DESCRIPTION: Record<InsightView, string> = {
  sources: "What new workspace owners answer when we ask how they first heard about Preb, next to what we tracked ourselves. Only owners who signed up since the question exists are asked.",
  ats: "What new workspace owners answer when we ask which ATS they use. Only owners who signed up since the question exists are asked.",
};

const PERIODS = [
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "all", label: "All time" },
];

const TEAM = [
  { id: "exclude", label: "Customers only" },
  { id: "include", label: "With team accounts" },
];

export interface InsightsShellProps {
  params: SourcesParams;
  /** Team accounts in the period, whether shown or not. */
  teamCount: number;
  children: ReactNode;
}

/** Frame of /admin/insights: title, the view switch (one view per onboarding question) and the filters both views share. State lives in the URL. */
export function InsightsShell({ params, teamCount, children }: InsightsShellProps) {
  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-title-2-medium text-text-primary">Insights</h1>
          <p className="text-body-regular text-text-secondary">{DESCRIPTION[params.view]}</p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <UrlSegmented aria-label="Question" param="view" value={params.view} defaultValue="sources" options={VIEWS} reset={["page"]} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <UrlSegmented aria-label="Period" param="period" value={params.period} defaultValue="90d" options={PERIODS} reset={["page"]} />
        </div>
        <div className="max-w-full overflow-x-auto">
          <UrlSegmented aria-label="Team accounts" param="team" value={params.team} defaultValue="exclude" options={TEAM} reset={["page"]} />
        </div>
        {teamCount > 0 ? (
          <span className="text-body-2-regular text-text-tertiary">
            {plural(teamCount, "team account", "team accounts")} {params.team === "include" ? "included" : "hidden"}
          </span>
        ) : null}
      </div>

      {children}
    </div>
  );
}
