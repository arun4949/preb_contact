import { describe, expect, it } from "vitest";
import { createOptOutToken, hashOptOutToken, looksLikeOptOutToken } from "./token";

describe("opt-out tokens", () => {
  it("creates a 43-char base64url token with a sha256 hex hash", () => {
    const { token, tokenHash } = createOptOutToken();
    expect(looksLikeOptOutToken(token)).toBe(true);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOptOutToken(token)).toBe(tokenHash);
  });

  it("rejects anything that is not a token before touching the database", () => {
    for (const bad of ["", "abc", "x".repeat(44), "a b".padEnd(43, "a"), "../".padEnd(43, "a")]) expect(looksLikeOptOutToken(bad), bad).toBe(false);
  });
});
