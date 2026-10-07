import { describe, expect, it } from "vitest";
import { catchAllRecord, fullRecord, invalidRecord } from "@/lib/fullenrich/__fixtures__/records";
import { batchStatusFromProvider, contactPatchFromRecord } from "./results";

describe("results", () => {
  it("maps provider batch statuses", () => {
    expect(batchStatusFromProvider("FINISHED")).toBe("finished");
    expect(batchStatusFromProvider("CREDITS_INSUFFICIENT")).toBe("credits_insufficient");
    expect(batchStatusFromProvider("CANCELED")).toBe("canceled");
    expect(batchStatusFromProvider("UNKNOWN")).toBe("failed");
    expect(batchStatusFromProvider("RATE_LIMIT")).toBe("failed");
  });

  it("produces an enriched row patch with derived cost and the raw record", () => {
    const patch = contactPatchFromRecord(fullRecord, "2026-10-07T00:00:00.000Z");
    expect(patch.status).toBe("enriched");
    expect(patch.credits_cost).toBe(14);
    expect(patch.work_email).toBe("gregoire@fullenrich.com");
    expect(patch.enriched_at).toBe("2026-10-07T00:00:00.000Z");
    expect(patch.result).toEqual(fullRecord);
  });

  it("marks rows with nothing billable as not_found at zero cost", () => {
    const patch = contactPatchFromRecord(invalidRecord);
    expect(patch.status).toBe("not_found");
    expect(patch.credits_cost).toBe(0);
    expect(patch.work_email).toBeNull();
  });

  it("keeps a catch-all email as a found (risky) result", () => {
    const patch = contactPatchFromRecord(catchAllRecord);
    expect(patch.status).toBe("enriched");
    expect(patch.work_email_status).toBe("CATCH_ALL");
    expect(patch.credits_cost).toBe(1);
  });
});
