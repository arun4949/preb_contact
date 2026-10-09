import { describe, expect, it } from "vitest";
import { cacheHashesFor, identifierHash, maskIdentifier, normaliseIdentifier, recordIdentifiers } from "./identifiers";
import type { EnrichmentRecord } from "@/lib/fullenrich/types";

describe("normaliseIdentifier", () => {
  it("lower-cases emails and rejects invalid ones", () => {
    expect(normaliseIdentifier("email", " Ada@Example.COM ")).toBe("ada@example.com");
    expect(normaliseIdentifier("email", "not an email")).toBeNull();
  });
  it("canonicalises LinkedIn URLs", () => {
    expect(normaliseIdentifier("linkedin", "linkedin.com/in/Ada-Lovelace/")).toBe("https://www.linkedin.com/in/ada-lovelace");
    expect(normaliseIdentifier("linkedin", "https://example.com/ada")).toBeNull();
  });
  it("keeps only digits of phone numbers", () => {
    expect(normaliseIdentifier("phone", "+1 (555) 123-4567")).toBe("15551234567");
    expect(normaliseIdentifier("phone", "123")).toBeNull();
  });
});

describe("identifierHash and masks", () => {
  it("hashes kind and value and never contains the value", () => {
    const h = identifierHash("email", "ada@example.com");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(identifierHash("linkedin", "ada@example.com"));
  });
  it("masks identifiers for the admin list", () => {
    expect(maskIdentifier("email", "ada@example.com")).toBe("a***@example.com");
    expect(maskIdentifier("linkedin", "https://www.linkedin.com/in/ada-lovelace")).toBe("linkedin.com/in/a***");
    expect(maskIdentifier("phone", "15551234567")).toBe("1*** 4567");
  });
  it("derives the cache input hashes for emails and LinkedIn URLs", () => {
    expect(cacheHashesFor("email", "ada@example.com")).toHaveLength(1);
    expect(cacheHashesFor("phone", "15551234567")).toHaveLength(0);
  });
});

describe("recordIdentifiers", () => {
  it("collects every email, phone and LinkedIn URL once", () => {
    const record = {
      input: { email: "Ada@Example.com", professional_network_url: "https://linkedin.com/in/ada" },
      contact_info: {
        most_probable_work_email: { email: "ada@example.com", status: "DELIVERABLE" },
        most_probable_personal_email: { email: "ada@gmail.com", status: "DELIVERABLE" },
        most_probable_phone: { number: "+1 555-123-4567" },
        work_emails: [{ email: "ada@example.com", status: "DELIVERABLE" }],
        personal_emails: [],
        phones: [{ number: "+1 555 123 4567" }, { number: "+49 170 1234567" }],
      },
      profile: { social_profiles: { professional_network: { url: "https://www.linkedin.com/in/Ada/" } } },
    } as unknown as EnrichmentRecord;
    const ids = recordIdentifiers(record).map((i) => `${i.kind}:${i.value}`);
    expect(ids).toEqual([
      "email:ada@example.com",
      "email:ada@gmail.com",
      "phone:15551234567",
      "phone:491701234567",
      "linkedin:https://www.linkedin.com/in/ada",
    ]);
  });
});
