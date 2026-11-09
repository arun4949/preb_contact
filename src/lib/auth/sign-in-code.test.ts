import { describe, expect, it } from "vitest";
import { formatSignInCode, isSignInCode, signInCodeGroup } from "./sign-in-code";

describe("sign-in code", () => {
  it("accepts 6 to 10 digits only", () => {
    expect(isSignInCode("123456")).toBe(true);
    expect(isSignInCode("81519179")).toBe(true);
    expect(isSignInCode("1234567890")).toBe(true);
    expect(isSignInCode("12345")).toBe(false);
    expect(isSignInCode("12345678901")).toBe(false);
    expect(isSignInCode("8151 9179")).toBe(false);
    expect(isSignInCode("abcdef")).toBe(false);
  });

  it("groups digits for reading", () => {
    expect(signInCodeGroup(6)).toBe(3);
    expect(signInCodeGroup(8)).toBe(4);
    expect(formatSignInCode("81519179")).toBe("8151 9179");
    expect(formatSignInCode("815191")).toBe("815 191");
    expect(formatSignInCode("8151917")).toBe("815 191 7");
  });
});
