import { describe, expect, it } from "vitest";
import { EMPTY_MAPPING } from "@/lib/csv/automap";
import { normaliseRows } from "@/lib/csv/normalize";
import { manualListName } from "./manual";

const HEADERS = ["First name", "Last name", "Company domain", "LinkedIn URL"];
const MAPPING = { ...EMPTY_MAPPING, first_name: 0, last_name: 1, domain: 2, linkedin_url: 3 };
const rows = (cells: string[][]) => normaliseRows(cells, HEADERS, MAPPING).rows;

describe("manualListName", () => {
  it("uses the first person's name", () => {
    expect(manualListName(rows([["Jon", "Snow", "stark.com", ""]]))).toBe("Jon Snow");
  });
  it("falls back to the LinkedIn slug", () => {
    expect(manualListName(rows([["", "", "", "https://www.linkedin.com/in/jsnow/"]]))).toBe("jsnow");
  });
  it("counts the other enrichable contacts", () => {
    const r = rows([
      ["Jon", "Snow", "stark.com", ""],
      ["", "", "", "linkedin.com/in/arya"],
      ["Only", "", "", ""], // not enrichable, not counted
    ]);
    expect(manualListName(r)).toBe("Jon Snow + 1 more");
  });
  it("dates the run when nothing is usable", () => {
    expect(manualListName(rows([["Only", "", "", ""]]), new Date("2026-10-08T12:00:00Z"))).toBe("Manual enrichment, Oct 8, 2026");
  });
});
