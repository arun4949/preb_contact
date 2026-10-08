import { describe, expect, it } from "vitest";
import { catchAllRecord, fullRecord, invalidRecord, reverseMissRecord, reverseRecord } from "./__fixtures__/records";
import { CREDIT_COST, CREDIT_MULTIPLIER, UPSTREAM_CREDIT_COST, contactCredits, mapRecord, toPrebCredits, uiEmailStatus } from "./mapping";

describe("mapping", () => {
  it("charges CREDIT_MULTIPLIER × the upstream cost table and converts batch costs", () => {
    expect(CREDIT_MULTIPLIER).toBe(2);
    expect(CREDIT_COST).toEqual({ work_email: 2, personal_email: 6, mobile_phone: 20, reverse: 2 });
    for (const k of Object.keys(UPSTREAM_CREDIT_COST) as (keyof typeof UPSTREAM_CREDIT_COST)[]) {
      expect(CREDIT_COST[k]).toBe(UPSTREAM_CREDIT_COST[k] * CREDIT_MULTIPLIER);
    }
    expect(toPrebCredits(15)).toBe(30);
    expect(toPrebCredits(0)).toBe(0);
    expect(toPrebCredits(-3)).toBe(0);
  });

  it("derives 2 + 6 + 20 Preb credits (2× upstream 1 + 3 + 10) for work + personal + mobile", () => {
    expect(contactCredits(fullRecord)).toBe(28);
  });

  it("charges catch-all work emails but not landlines", () => {
    expect(contactCredits(catchAllRecord)).toBe(2);
    expect(uiEmailStatus(catchAllRecord.contact_info!.most_probable_work_email!.status)).toBe("risky");
  });

  it("charges nothing for INVALID results and hides the email", () => {
    expect(contactCredits(invalidRecord)).toBe(0);
    const m = mapRecord(invalidRecord);
    expect(m.work_email).toBeNull();
    expect(m.work_email_status).toBe("INVALID");
    expect(m.found).toBe(false);
  });

  it("reverse lookup: 2 credits and names when a profile came back, nothing otherwise", () => {
    expect(contactCredits(reverseRecord, "reverse")).toBe(2);
    const m = mapRecord(reverseRecord, "reverse");
    expect(m.found).toBe(true);
    expect(m.first_name).toBe("Ada");
    expect(m.last_name).toBe("Lovelace");
    expect(m.full_name).toBe("Ada Lovelace");
    expect(m.job_title).toBe("Analyst");
    expect(m.company).toBe("Analytical Engine Co");
    expect(m.linkedin_url).toBe("https://www.linkedin.com/in/ada/");
    expect(m.work_email).toBeNull();

    expect(contactCredits(reverseMissRecord, "reverse")).toBe(0);
    const miss = mapRecord(reverseMissRecord, "reverse");
    expect(miss.found).toBe(false);
    expect(miss.first_name).toBeNull();

    // An enrich record never charges the reverse credit and never overwrites names.
    expect(mapRecord(fullRecord).first_name).toBeNull();
    expect(contactCredits(reverseRecord)).toBe(0);
  });

  it("maps profile columns with input fallbacks", () => {
    const m = mapRecord(fullRecord);
    expect(m.job_title).toBe("Co-founder & CEO");
    expect(m.company).toBe("FullEnrich");
    expect(m.company_domain).toBe("fullenrich.com");
    expect(m.company_logo_url).toBe("https://logo.test/fe.png");
    expect(m.location).toBe("Paris, Île-de-France, France");
    expect(m.linkedin_url).toBe("https://www.linkedin.com/in/demoge/");
    expect(m.phone_meta?.line_type).toBe("MOBILE");

    const noProfile = mapRecord(catchAllRecord);
    expect(noProfile.company_domain).toBe("example.com");
    expect(noProfile.job_title).toBeNull();
    expect(noProfile.found).toBe(true);
  });
});
