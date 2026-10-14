import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("lead access cookie", () => {
  const prev = process.env.SUPABASE_SECRET_KEY;
  beforeAll(() => {
    process.env.SUPABASE_SECRET_KEY = "test-secret";
  });
  afterAll(() => {
    process.env.SUPABASE_SECRET_KEY = prev;
  });

  it("signs for 30 days and verifies only the same share before expiry", async () => {
    const { signLeadAccess, verifyLeadAccess, leadCookieName } = await import("./access-cookie");
    const id = "7f4d0a2e-9c1b-4c5e-8f6a-1d2e3f4a5b6c";
    const now = Date.UTC(2026, 9, 14);
    const { value, expiresAt } = signLeadAccess(id, now);
    expect(expiresAt.getTime() - now).toBe(30 * 86_400_000);
    expect(verifyLeadAccess(id, value, now)).toBe(true);
    expect(verifyLeadAccess(id, value, now + 31 * 86_400_000)).toBe(false);
    expect(verifyLeadAccess("00000000-0000-0000-0000-000000000000", value, now)).toBe(false);
    expect(verifyLeadAccess(id, value.replace(/.$/, (c) => (c === "A" ? "B" : "A")), now)).toBe(false);
    expect(verifyLeadAccess(id, undefined, now)).toBe(false);
    expect(verifyLeadAccess(id, "garbage", now)).toBe(false);
    expect(leadCookieName(id)).toBe("preb_lead_7f4d0a2e9c1b4c5e8f6a1d2e3f4a5b6c");
  });
});
