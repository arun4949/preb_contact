import { describe, expect, it } from "vitest";
import type { ContactRow } from "./segments";
import { PREB_COLUMNS, rowCells } from "./export-columns";

const row = {
  raw: { Name: "Ada Lovelace", Company: "Analytical Engine Co" },
  work_email: "ada@example.com",
  work_email_status: "CATCH_ALL",
  personal_email: "ada@personal.test",
  personal_email_status: "DELIVERABLE",
  phone: "+44 7700 900123",
  phone_meta: { line_type: "MOBILE" },
  job_title: "Analyst",
  company: "Analytical Engine Co",
  company_domain: "example.com",
  location: "London",
  linkedin_url: "https://www.linkedin.com/in/ada/",
  status: "enriched",
  skip_reason: null,
  credits_cost: 28,
} as unknown as ContactRow;

describe("export columns", () => {
  it("lists personal email and phone before the work email fallback", () => {
    expect(PREB_COLUMNS.slice(0, 6)).toEqual(["Preb: Personal email", "Preb: Personal email status", "Preb: Phone", "Preb: Phone type", "Preb: Work email", "Preb: Work email status"]);
  });
  it("writes cells in the same order as the headers", () => {
    const cells = rowCells(row, ["Name", "Company"]);
    expect(cells.slice(0, 2)).toEqual(["Ada Lovelace", "Analytical Engine Co"]);
    const preb = Object.fromEntries(PREB_COLUMNS.map((h, i) => [h, cells[2 + i]]));
    expect(preb["Preb: Personal email"]).toBe("ada@personal.test");
    expect(preb["Preb: Personal email status"]).toBe("Valid");
    expect(preb["Preb: Phone"]).toBe("+44 7700 900123");
    expect(preb["Preb: Phone type"]).toBe("Mobile");
    expect(preb["Preb: Work email"]).toBe("ada@example.com");
    expect(preb["Preb: Work email status"]).toBe("Risky (catch-all)");
    expect(preb["Preb: Status"]).toBe("Enriched");
    expect(preb["Preb: Credits"]).toBe(28);
  });
});
