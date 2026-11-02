import { describe, expect, it } from "vitest";
import { contactsInputSchema, fieldsInputSchema, fieldsText, normaliseContacts, rowLabel, skipText } from "./contacts";
import { MCP_MAX_CONTACTS } from "./config";

describe("MCP contact input", () => {
  it("applies the app's enrichable rules: LinkedIn URL, or name plus company, or email only", () => {
    const { rows, summary } = normaliseContacts([
      { linkedin_url: "https://www.linkedin.com/in/ada-lovelace/" },
      { first_name: "Grace", last_name: "Hopper", company_domain: "https://www.navy.mil/about" },
      { full_name: "Alan Turing", company_name: "Bletchley Park" },
      { email: "unknown@acme.com" },
      { first_name: "Only" },
      { linkedin_url: "https://www.linkedin.com/in/ada-lovelace" },
    ]);
    expect(rows.map((r) => r.enrichable)).toEqual([true, true, true, false, false, false]);
    expect(rows[1].domain).toBe("navy.mil");
    expect(rows[2].first_name).toBe("Alan");
    expect(rows[2].last_name).toBe("Turing");
    expect(rows[3].skipReason).toBe("email_only");
    expect(rows[4].skipReason).toBe("missing_fields");
    expect(rows[5].skipReason).toBe("duplicate");
    expect(summary).toEqual({ total: 6, enrichable: 3, missingFields: 1, emailOnly: 1, duplicates: 1 });
  });

  it("explains skips and labels rows for the assistant", () => {
    const { rows } = normaliseContacts([{ email: "x@y.com" }, { first_name: "Only" }, { linkedin_url: "https://linkedin.com/in/a" }, { linkedin_url: "https://linkedin.com/in/a" }]);
    expect(skipText(rows[0])).toContain("reverse lookup");
    expect(skipText(rows[1])).toContain("LinkedIn URL");
    expect(skipText(rows[3])).toContain("duplicate");
    expect(rowLabel(rows[0])).toBe("x@y.com");
    expect(rowLabel(rows[1])).toBe("Only");
  });

  it("validates the schema limits", () => {
    expect(contactsInputSchema.safeParse([]).success).toBe(false);
    expect(contactsInputSchema.safeParse(Array.from({ length: MCP_MAX_CONTACTS + 1 }, () => ({ email: "a@b.co" }))).success).toBe(false);
    expect(contactsInputSchema.safeParse([{ first_name: " Ada " }]).data?.[0].first_name).toBe("Ada");
    expect(fieldsInputSchema.safeParse([]).success).toBe(false);
    expect(fieldsInputSchema.safeParse(["work_email", "fax"]).success).toBe(false);
    expect(fieldsInputSchema.safeParse(["mobile_phone"]).success).toBe(true);
  });

  it("writes field lists the way the app does", () => {
    expect(fieldsText(["work_email"])).toBe("work email");
    expect(fieldsText(["work_email", "mobile_phone"])).toBe("work email and mobile phone");
    expect(fieldsText(["work_email", "personal_email", "mobile_phone"])).toBe("work email, personal email and mobile phone");
  });
});
