import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { dispatch, type DispatchSummary } from "./dispatch";
import { reconcile, type ReconcileSummary } from "./reconcile";
import { finalizeLists, settlePending } from "./settle";
import { log, logError } from "./shared";

export interface TickSummary {
  ran: true;
  durationMs: number;
  settled: number;
  reconcile: ReconcileSummary | null;
  dispatch: DispatchSummary | null;
  finalized: number;
  errors: string[];
}

/**
 * One engine pass: settle → reconcile → dispatch → finalize. Each step is
 * isolated so one failure does not starve the others. Safe to run
 * concurrently (cron + `after()`): every claim is atomic in SQL.
 */
export async function runTick(): Promise<TickSummary> {
  const started = Date.now();
  const admin = createAdminClient();
  const summary: TickSummary = { ran: true, durationMs: 0, settled: 0, reconcile: null, dispatch: null, finalized: 0, errors: [] };

  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      summary.errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      logError(`tick.${name}_failed`, error);
    }
  };

  await step("settle", async () => {
    summary.settled = await settlePending(admin);
  });
  await step("reconcile", async () => {
    summary.reconcile = await reconcile(admin);
  });
  await step("dispatch", async () => {
    summary.dispatch = await dispatch(admin);
  });
  await step("finalize", async () => {
    summary.finalized = await finalizeLists(admin);
  });

  summary.durationMs = Date.now() - started;
  log("tick.done", { ...summary });
  return summary;
}
