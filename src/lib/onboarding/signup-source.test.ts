import { describe, expect, it } from "vitest";
import {
  SIGNUP_SOURCE_DETAIL_MAX,
  SIGNUP_SOURCE_OPTIONS,
  isSignupSourceFresh,
  parseSignupSourceAnswer,
  shownPosition,
  signupSourceOrder,
} from "./signup-source";

const USERS = Array.from({ length: 200 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

describe("signup source options", () => {
  it("has unique keys that fit the database format check", () => {
    const keys = SIGNUP_SOURCE_OPTIONS.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z_]{1,40}$/);
  });

  it("uses no dash as punctuation in its copy", () => {
    for (const option of SIGNUP_SOURCE_OPTIONS) {
      for (const text of [option.label, option.short ?? "", option.detailLabel ?? "", option.detailPlaceholder ?? ""]) {
        expect(text).not.toMatch(/[—–]| - /);
      }
    }
  });
});

describe("signupSourceOrder", () => {
  it("is stable for the same person", () => {
    expect(signupSourceOrder(USERS[7])).toEqual(signupSourceOrder(USERS[7]));
  });

  it("always contains every option once, with Other and Not sure last", () => {
    for (const user of USERS) {
      const order = signupSourceOrder(user);
      expect([...order].sort()).toEqual(SIGNUP_SOURCE_OPTIONS.map((option) => option.key).sort());
      expect(order.slice(-2)).toEqual(["other", "not_sure"]);
    }
  });

  it("spreads the first place across the channels", () => {
    const first = new Map<string, number>();
    for (const user of USERS) {
      const key = signupSourceOrder(user)[0];
      first.set(key, (first.get(key) ?? 0) + 1);
    }
    // Ten channels over 200 people: every channel leads sometimes, none dominates.
    expect(first.size).toBe(10);
    expect(Math.max(...first.values())).toBeLessThan(50);
  });
});

describe("parseSignupSourceAnswer", () => {
  it("accepts a known key and tidies the detail", () => {
    expect(parseSignupSourceAnswer("colleague", "  Ada \n Lovelace  ")).toEqual({ source: "colleague", detail: "Ada Lovelace" });
  });

  it("stores no detail when it is empty or the option has no follow-up", () => {
    expect(parseSignupSourceAnswer("linkedin", "   ")).toEqual({ source: "linkedin", detail: null });
    expect(parseSignupSourceAnswer("not_sure", "something")).toEqual({ source: "not_sure", detail: null });
  });

  it("caps the detail", () => {
    expect(parseSignupSourceAnswer("other", "x".repeat(500))?.detail).toHaveLength(SIGNUP_SOURCE_DETAIL_MAX);
  });

  it("rejects unknown and hostile values", () => {
    for (const value of ["", "Google", "search; drop table", null, undefined, 3, ["search"]]) {
      expect(parseSignupSourceAnswer(value, "x")).toBeNull();
    }
  });
});

describe("shownPosition", () => {
  it("is 1-based and null for a key that was not shown", () => {
    expect(shownPosition(["a", "b"], "b")).toBe(2);
    expect(shownPosition(["a", "b"], "c")).toBeNull();
  });
});

describe("isSignupSourceFresh", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  it("is true within a day and false after it or for a broken date", () => {
    expect(isSignupSourceFresh("2026-11-19T11:59:00Z", now)).toBe(true);
    expect(isSignupSourceFresh("2026-11-18T12:30:00Z", now)).toBe(true);
    expect(isSignupSourceFresh("2026-11-18T11:00:00Z", now)).toBe(false);
    expect(isSignupSourceFresh("nonsense", now)).toBe(false);
  });
});
