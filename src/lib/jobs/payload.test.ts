import { describe, expect, it } from "vitest";
import { buildEnrichPayload, buildReversePayload, toEnrichFields, type PayloadContact } from "./payload";

const hook = "https://app.test/api/webhooks/fullenrich";
const contacts: PayloadContact[] = [
  { id: "c1", first_name: "Grégoire", last_name: "Démogé", domain: "fullenrich.com", company_name: "FullEnrich", linkedin_url: "https://www.linkedin.com/in/demoge/", email_input: null },
  { id: "c2", first_name: null, last_name: null, domain: null, company_name: null, linkedin_url: "https://www.linkedin.com/in/jane/", email_input: "jane@example.com" },
];

describe("payload builders", () => {
  it("maps Preb fields to provider enrich_fields without duplicates", () => {
    expect(toEnrichFields(["work_email", "mobile_phone", "work_email", "bogus"])).toEqual(["contact.work_emails", "contact.phones"]);
  });

  it("builds the bulk request with webhooks, custom ids and only non-empty inputs", () => {
    const p = buildEnrichPayload({ id: "l1", enrich_fields: ["work_email", "personal_email"] }, "b1", contacts, hook);
    expect(p.name).toBe("list_l1_batch_b1");
    expect(p.webhook_url).toBe(hook);
    expect(p.webhook_events?.contact_finished).toBe(hook);
    expect(p.data).toHaveLength(2);
    expect(p.data[0]).toEqual({
      enrich_fields: ["contact.work_emails", "contact.personal_emails"],
      custom: { contact_id: "c1", list_id: "l1", batch_id: "b1" },
      first_name: "Grégoire",
      last_name: "Démogé",
      domain: "fullenrich.com",
      company_name: "FullEnrich",
      linkedin_url: "https://www.linkedin.com/in/demoge/",
    });
    expect(Object.keys(p.data[1])).toEqual(["enrich_fields", "custom", "linkedin_url"]);
  });

  it("keeps custom values within provider limits (strings, ≤100 chars)", () => {
    const p = buildEnrichPayload({ id: "l1", enrich_fields: ["work_email"] }, "b1", contacts, hook);
    for (const row of p.data) {
      expect(Object.keys(row.custom).length).toBeLessThanOrEqual(10);
      for (const v of Object.values(row.custom)) expect(typeof v === "string" && v.length <= 100).toBe(true);
    }
  });

  it("throws when the list has no fields", () => {
    expect(() => buildEnrichPayload({ id: "l1", enrich_fields: [] }, "b1", contacts, hook)).toThrow();
  });

  it("builds the reverse request only for rows with an email", () => {
    const p = buildReversePayload({ id: "l1" }, "b1", contacts, hook);
    expect(p.data).toEqual([{ email: "jane@example.com", custom: { contact_id: "c2", list_id: "l1", batch_id: "b1" } }]);
  });
});
