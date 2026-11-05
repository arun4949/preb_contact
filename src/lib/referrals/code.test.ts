import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, generateReferralCode, maskEmail, normalizeCode } from "./code";

describe("generateReferralCode", () => {
  it("makes 8 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateReferralCode();
      expect(code).toHaveLength(8);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
    expect(CODE_ALPHABET).not.toMatch(/[0OI1L]/);
  });
  it("does not repeat itself in a small sample", () => {
    const codes = new Set(Array.from({ length: 500 }, generateReferralCode));
    expect(codes.size).toBe(500);
  });
});

describe("normalizeCode", () => {
  it("accepts a code typed in any case, with spaces or dashes", () => {
    expect(normalizeCode("abcd efgh")).toBe("ABCDEFGH");
    expect(normalizeCode(" ABCD-EFGH ")).toBe("ABCDEFGH");
  });
  it("rejects wrong lengths, ambiguous letters and injection attempts", () => {
    for (const bad of ["", "ABCDEFG", "ABCDEFGHJ", "ABCD0FGH", "ABCDOFGH", "ABCDIFGH", "ABCD1FGH", "ABCDLFGH", "ABCD'FGH", "../../x", null, undefined]) {
      expect(normalizeCode(bad), String(bad)).toBeNull();
    }
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("John.Doe@Acme.com")).toBe("j***@acme.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });
  it("never leaks a malformed value", () => {
    expect(maskEmail("not-an-email")).toBe("***");
  });
});
