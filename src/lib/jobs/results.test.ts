import { describe, expect, it } from "vitest";
import { catchAllRecord, fullRecord, invalidRecord, reverseMissRecord, reverseRecord } from "@/lib/fullenrich/__fixtures__/records";
import { batchStatusFromProvider, cachedContactPatch, contactPatchFromRecord } from "./results";

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
    expect(patch.credits_cost).toBe(28);
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
    expect(patch.credits_cost).toBe(2);
  });

  it("cache fill marks the row cached at zero cost for both kinds", () => {
    const enrich = cachedContactPatch(fullRecord, "enrich", "2026-10-08T00:00:00.000Z");
    expect(enrich.status).toBe("cached");
    expect(enrich.credits_cost).toBe(0);
    expect(enrich.work_email).toBe("gregoire@fullenrich.com");
    expect(enrich.first_name).toBeUndefined();
    expect(enrich.enriched_at).toBe("2026-10-08T00:00:00.000Z");

    const reverse = cachedContactPatch(reverseRecord, "reverse");
    expect(reverse.status).toBe("cached");
    expect(reverse.credits_cost).toBe(0);
    expect(reverse.full_name).toBeTruthy();
    expect(reverse.result).toEqual(reverseRecord);

    // A cached miss stays a free cached row with no name (not counted as identified).
    const miss = cachedContactPatch(reverseMissRecord, "reverse");
    expect(miss.status).toBe("cached");
    expect(miss.full_name).toBeUndefined();
  });
});
