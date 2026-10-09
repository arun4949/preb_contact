import { describe, expect, it } from "vitest";
import { emailHash } from "./deletion";

describe("emailHash", () => {
  it("is case and whitespace insensitive and never contains the address", () => {
    const a = emailHash("  Ada@Example.com ");
    expect(a).toBe(emailHash("ada@example.com"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("ada");
  });

  it("is plain sha256 of the lower-cased address, like the Postgres guard", () => {
    // echo -n "ada@example.com" | shasum -a 256
    expect(emailHash("ADA@example.com")).toBe("b5fc85e55755f9e0d030a10ab4429b6b2944855f9a0d60077fe832becbc41d72");
  });
});
