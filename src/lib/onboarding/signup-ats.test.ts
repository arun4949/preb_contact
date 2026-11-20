import { describe, expect, it } from "vitest";
import { SIGNUP_ATS_DETAIL_MAX, SIGNUP_ATS_NONE, SIGNUP_ATS_OPTIONS, SIGNUP_ATS_OTHER, parseSignupAtsAnswer, signupAtsOption } from "./signup-ats";

describe("signup ATS options", () => {
  it("has unique keys that fit the database format check", () => {
    const keys = SIGNUP_ATS_OPTIONS.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z_]{1,40}$/);
  });

  it("lists the systems in the agreed order, with No ATS and Other last", () => {
    expect(SIGNUP_ATS_OPTIONS.map((option) => option.label)).toEqual([
      "Bullhorn",
      "Crelate",
      "Loxo",
      "JobDiva",
      "Ceipal",
      "Recruit CRM",
      "Greenhouse",
      "Ashby",
      "No ATS (spreadsheet or CRM)",
      "Other",
    ]);
    expect(SIGNUP_ATS_OPTIONS.at(-2)?.key).toBe(SIGNUP_ATS_NONE);
    expect(SIGNUP_ATS_OPTIONS.at(-1)?.key).toBe(SIGNUP_ATS_OTHER);
  });

  it("offers the free text line for Other only", () => {
    expect(SIGNUP_ATS_OPTIONS.filter((option) => option.detailLabel !== null).map((option) => option.key)).toEqual([SIGNUP_ATS_OTHER]);
  });

  it("uses no dash as punctuation in its copy", () => {
    for (const option of SIGNUP_ATS_OPTIONS) {
      for (const text of [option.label, option.short ?? "", option.detailLabel ?? "", option.detailPlaceholder ?? ""]) {
        expect(text).not.toMatch(/[—–]| - /);
      }
    }
  });
});

describe("parseSignupAtsAnswer", () => {
  it("accepts a listed system and never stores a detail for it", () => {
    expect(parseSignupAtsAnswer("bullhorn", "ignored")).toEqual({ ats: "bullhorn", detail: null });
    expect(parseSignupAtsAnswer("none", "")).toEqual({ ats: "none", detail: null });
  });

  it("keeps the optional detail of Other, tidied and capped", () => {
    expect(parseSignupAtsAnswer("other", null)).toEqual({ ats: "other", detail: null });
    expect(parseSignupAtsAnswer("other", "   ")).toEqual({ ats: "other", detail: null });
    expect(parseSignupAtsAnswer("other", "  Workday \n Recruiting ")).toEqual({ ats: "other", detail: "Workday Recruiting" });
    expect(parseSignupAtsAnswer("other", "x".repeat(500))?.detail).toHaveLength(SIGNUP_ATS_DETAIL_MAX);
  });

  it("rejects anything that is not an option", () => {
    for (const value of ["", "Bullhorn", "workday", "other; drop table", null, undefined, 7, ["bullhorn"]]) expect(parseSignupAtsAnswer(value, "x")).toBeNull();
  });

  it("looks options up by key", () => {
    expect(signupAtsOption("recruit_crm")?.label).toBe("Recruit CRM");
    expect(signupAtsOption("nope")).toBeNull();
    expect(signupAtsOption(null)).toBeNull();
  });
});
