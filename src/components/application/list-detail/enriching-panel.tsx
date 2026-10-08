"use client";

import { useEffect, useMemo, useState } from "react";
import { RiCoinLine, RiMailSendLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { useSettingsUrl } from "@/components/application/settings/use-settings-url";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { useCountUp } from "@/hooks/use-count-up";
import type { ListEta } from "@/lib/lists/queries";
import type { ListRow } from "@/lib/supabase/queries";
import { EnrichmentProgress } from "./enrichment-progress";

const THINKING = [
  "Checking 20+ data sources…",
  "Matching people to companies…",
  "Verifying email deliverability…",
  "Looking up mobile numbers…",
  "Cross-checking LinkedIn profiles…",
  "Removing invalid addresses…",
];

export function enrichmentTarget(list: Pick<ListRow, "row_limit" | "enrichable_rows">): number {
  return list.row_limit ? Math.min(list.row_limit, list.enrichable_rows) : list.enrichable_rows;
}

function stepsFor(list: ListRow): { steps: string[]; completed: number } {
  const wantsPhone = list.enrich_fields.includes("mobile_phone");
  const steps = ["Validating rows", "Submitting to enrichment network", "Finding emails", "Verifying deliverability", ...(wantsPhone ? ["Finding mobile numbers"] : []), "Finalising"];
  const target = enrichmentTarget(list);
  const f = target > 0 ? list.processed_rows / target : 0;
  let completed: number;
  if (list.status === "queued") completed = 0;
  else if (list.submitted_rows === 0) completed = 1;
  else if (list.processed_rows === 0) completed = 2;
  else if (list.status === "stopping" || f >= 1) completed = steps.length - 1;
  else {
    // Spread the middle steps over the processed fraction.
    const middle = steps.length - 3; // between "Submitting" and "Finalising"
    completed = 2 + Math.min(middle - 1, Math.floor(f * middle));
  }
  return { steps, completed };
}

function formatEta(seconds: number | null): string {
  if (seconds == null) return "Estimating time left…";
  if (seconds < 60) return "Less than a minute left";
  const m = Math.round(seconds / 60);
  if (m < 60) return `About ${m} ${m === 1 ? "minute" : "minutes"} left`;
  const h = Math.round(m / 60);
  return `About ${h} ${h === 1 ? "hour" : "hours"} left`;
}

const PAUSED_COPY: Partial<Record<ListRow["status"], string>> = {
  paused_credits: "Paused, add credits to continue. Your progress so far is saved.",
  paused_upstream: "Paused because our enrichment provider is temporarily unavailable. We retry automatically.",
  failed: "Enrichment stopped after repeated provider errors. Our team has been alerted.",
};

/** Centered progress panel for running or paused lists (plan § List detail · enriching). */
export function EnrichingPanel({ list, eta }: { list: ListRow; eta: ListEta }) {
  const { openSettings } = useSettingsUrl();
  const { steps, completed } = stepsFor(list);
  const paused = list.status in PAUSED_COPY;
  const target = enrichmentTarget(list);
  const processed = useCountUp(list.processed_rows, 600);
  const [msg, setMsg] = useState(0);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setMsg((m) => (m + 1) % THINKING.length), 4000);
    return () => clearInterval(t);
  }, [paused]);

  const subtitle = useMemo(() => {
    if (paused) return PAUSED_COPY[list.status];
    if (list.status === "queued") return "Starting in a few seconds…";
    if (list.status === "stopping") return "Finishing contacts already in progress. Nothing new is submitted.";
    return formatEta(eta.seconds);
  }, [paused, list.status, eta.seconds]);

  return (
    <section className="mx-auto w-full max-w-[720px] rounded-3xl border border-border-button-default bg-background-primary-default p-6 sm:p-8">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-10">
        <EnrichmentProgress steps={steps} completedCount={completed} paused={paused} className="w-full md:w-[300px] md:shrink-0" />
        <div className="flex w-full flex-1 flex-col items-center gap-3 text-center md:items-start md:text-start">
          <p className="text-title-1-medium text-text-primary tabular-nums">
            {processed.toLocaleString("en-US")} <span className="text-text-tertiary">/ {target.toLocaleString("en-US")}</span>{" "}
            <span className="text-title-3-semibold text-text-secondary">contacts</span>
          </p>
          <p className="text-body-regular text-text-secondary">{subtitle}</p>
          {!paused ? <AgentThinking variant="stars" label={THINKING[msg]} tone="subtle" showTimer={false} /> : null}
          {list.status === "paused_credits" ? (
            <Button size="small" leadingIcon={RiCoinLine} className="rounded-full" onClick={() => openSettings("billing", { plan: true })}>
              Buy credits
            </Button>
          ) : null}
          <p className="mt-2 flex items-center gap-2 text-body-2-regular text-text-tertiary">
            <RiMailSendLine className="size-4 shrink-0" aria-hidden />
            You can leave this page, we&apos;ll email you when it&apos;s done.
          </p>
        </div>
      </div>
    </section>
  );
}
