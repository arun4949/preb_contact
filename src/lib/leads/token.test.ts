import { describe, expect, it } from "vitest";
import { codeMatches, createShareToken, generateCode, hashShareToken, looksLikeCode, looksLikeShareToken } from "./token";

describe("lead share tokens and codes", () => {
  it("creates a 43-char base64url token whose hash is the lookup key", () => {
    const { token, tokenHash } = createShareToken();
    expect(looksLikeShareToken(token)).toBe(true);
    expect(tokenHash).toBe(hashShareToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(looksLikeShareToken("short")).toBe(false);
  });

  it("generates 4-digit codes, leading zeros included", () => {
    for (let i = 0; i < 200; i += 1) expect(looksLikeCode(generateCode())).toBe(true);
    expect(looksLikeCode("12345")).toBe(false);
    expect(looksLikeCode("12a4")).toBe(false);
  });

  it("compares codes in constant time and rejects malformed input", () => {
    expect(codeMatches("0420", "0420")).toBe(true);
    expect(codeMatches("0421", "0420")).toBe(false);
    expect(codeMatches("", "0420")).toBe(false);
    expect(codeMatches("042", "0420")).toBe(false);
  });
});
