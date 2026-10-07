import { describe, expect, it } from "vitest";
import { csvCell, csvLine, safeFileName } from "@/lib/csv/export";
import { parseContactQuery } from "./contact-query";
import { contactUiStatus } from "./segments";

describe("parseContactQuery", () => {
  it("falls back to defaults on garbage", () => {
    expect(parseContactQuery({ page: "-3", size: "7", sort: "drop table", dir: "sideways", email: "x", phone: "y" })).toEqual({
      page: 1,
      pageSize: 25,
      sort: "row",
      dir: "asc",
      q: "",
      email: "all",
      phone: null,
    });
  });

  it("accepts valid values and truncates long search terms", () => {
    const q = parseContactQuery({ page: "3", size: "100", sort: "company", dir: "desc", q: "a".repeat(200), email: "risky", phone: "found" });
    expect(q).toMatchObject({ page: 3, pageSize: 100, sort: "company", dir: "desc", email: "risky", phone: "found" });
    expect(q.q).toHaveLength(120);
  });
});

describe("csv export helpers", () => {
  it("quotes and escapes cells, neutralises formulas", () => {
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe("");
    expect(csvLine(["a", 1, "b,c"])).toBe('a,1,"b,c"\r\n');
  });

  it("builds a safe file name", () => {
    expect(safeFileName("Sales Directors / NYC (Q4)!", "-valid-emails")).toBe("Sales-Directors-NYC-Q4-valid-emails.csv");
    expect(safeFileName("   ", "")).toBe("list.csv");
  });
});

describe("contactUiStatus", () => {
  it("maps statuses and skip reasons", () => {
    expect(contactUiStatus({ status: "submitted", skip_reason: null })).toEqual({ kind: "pending" });
    expect(contactUiStatus({ status: "cached", skip_reason: null })).toEqual({ kind: "cached" });
    expect(contactUiStatus({ status: "skipped", skip_reason: "row_limit" })).toEqual({ kind: "skipped", reason: "Over the row limit" });
    expect(contactUiStatus({ status: "failed", skip_reason: "provider_lost" })).toEqual({ kind: "skipped", reason: "Provider lost the request" });
  });
});
