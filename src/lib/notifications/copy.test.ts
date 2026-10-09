import { describe, expect, it } from "vitest";
import { creditsExpiringCopy, creditsLowCopy, listFinishedCopy, listPausedCreditsCopy, planCopy, roleChangedCopy } from "./copy";

const list = { id: "l1", name: "Q4 hires", source: "csv", processed_rows: 120, found_work_email: 90, found_personal_email: 0, found_phone: 12, identified_rows: 0, credits_used: 420 };

const noDashes = (s: string) => expect(s).not.toMatch(/—|–| - /);

describe("notification copy", () => {
  it("summarises a finished list", () => {
    const c = listFinishedCopy(list, false);
    expect(c.kind).toBe("list_finished");
    expect(c.title).toBe("Q4 hires is ready");
    expect(c.body).toBe("120 contacts processed. 90 work emails, 12 mobile numbers found. 420 credits used.");
    expect(c.href).toBe("/lists/l1");
    expect(c.status).toBe("success");
  });
  it("routes manual runs to the Enrich tab", () => {
    const c = listFinishedCopy({ ...list, source: "manual", name: "Jon Snow + 2 more" }, false);
    expect(c.title).toBe("Enrichment of Jon Snow + 2 more is ready");
    expect(c.href).toBe("/enrich");
  });
  it("handles stopped lists and empty results", () => {
    const c = listFinishedCopy({ ...list, found_work_email: 0, found_phone: 0, credits_used: 1, processed_rows: 1 }, true);
    expect(c.kind).toBe("list_stopped");
    expect(c.body).toBe("1 contact processed. Nothing new was found. 1 credit used.");
    expect(c.status).toBe("neutral");
  });
  it("links paused lists to the plan picker", () => {
    const c = listPausedCreditsCopy(list, 30);
    expect(c.href).toBe("/lists/l1?settings=billing&plan=1");
    expect(c.body).toContain("30 contacts are waiting");
  });
  it("gives members no billing link", () => {
    expect(creditsLowCopy({ workspaceName: "Acme", available: 40, planCredits: 1000, canBuy: true }).href).toContain("settings=billing");
    expect(creditsLowCopy({ workspaceName: "Acme", available: 40, planCredits: 1000, canBuy: false }).href).toBeNull();
  });
  it("words expiry relative to today", () => {
    expect(creditsExpiringCopy({ amount: 50, expiresAt: "2026-10-16T00:00:00Z", days: 7, trial: true }).title).toBe("Your trial ends in 7 days");
    expect(creditsExpiringCopy({ amount: 500, expiresAt: "2026-10-10T00:00:00Z", days: 1, trial: false }).title).toBe("500 credits expire tomorrow");
  });
  it("never uses dashes as punctuation", () => {
    for (const c of [
      listFinishedCopy(list, false),
      listPausedCreditsCopy(list, 3),
      creditsLowCopy({ workspaceName: "Acme", available: 1, planCredits: 10, canBuy: true }),
      planCopy("plan_cancel_scheduled", { planName: "Preb 1k", periodEnd: "2026-11-08T00:00:00Z" }),
      roleChangedCopy("Acme", "admin"),
    ]) {
      noDashes(c.title);
      noDashes(c.body);
    }
  });
});
