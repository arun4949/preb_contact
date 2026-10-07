import { describe, expect, it } from "vitest";
import { signBody, verifySignature } from "./signature";

describe("webhook signature", () => {
  const secret = "api-key-123";
  const body = JSON.stringify({ id: "enr-1", status: "FINISHED", data: [] });

  it("accepts the hex HMAC-SHA1 of the raw body", () => {
    expect(verifySignature(body, signBody(body, secret), secret)).toBe(true);
  });

  it("is case-insensitive on the hex digest", () => {
    expect(verifySignature(body, signBody(body, secret).toUpperCase(), secret)).toBe(true);
  });

  it("rejects a missing, truncated or foreign signature", () => {
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, signBody(body, secret).slice(0, 10), secret)).toBe(false);
    expect(verifySignature(body, signBody(body, "other-key"), secret)).toBe(false);
  });

  it("rejects when the body was altered after signing", () => {
    const sig = signBody(body, secret);
    expect(verifySignature(body + " ", sig, secret)).toBe(false);
  });
});
