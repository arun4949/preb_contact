import { describe, expect, it } from "vitest";
import { catchAllRecord, fullRecord, invalidRecord } from "./__fixtures__/records";
import { contactCredits, mapRecord, uiEmailStatus } from "./mapping";

describe("mapping", () => {
  it("derives 1 + 3 + 10 credits for work + personal + mobile", () => {
    expect(contactCredits(fullRecord)).toBe(14);
  });

  it("charges catch-all work emails but not landlines", () => {
    expect(contactCredits(catchAllRecord)).toBe(1);
    expect(uiEmailStatus(catchAllRecord.contact_info!.most_probable_work_email!.status)).toBe("risky");
  });

  it("charges nothing for INVALID results and hides the email", () => {
    expect(contactCredits(invalidRecord)).toBe(0);
    const m = mapRecord(invalidRecord);
    expect(m.work_email).toBeNull();
    expect(m.work_email_status).toBe("INVALID");
    expect(m.found).toBe(false);
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
