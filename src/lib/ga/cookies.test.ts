import { describe, expect, it } from "vitest";
import { gaClientIdFromCookie, gaSessionCookieName, gaSessionIdFromCookie } from "./cookies";

describe("GA cookie parsing", () => {
  it("reads the client id from _ga", () => {
    expect(gaClientIdFromCookie("GA1.1.1234567890.1700000000")).toBe("1234567890.1700000000");
    expect(gaClientIdFromCookie("GA1.2.99.1")).toBe("99.1");
    expect(gaClientIdFromCookie("garbage")).toBeNull();
    expect(gaClientIdFromCookie(undefined)).toBeNull();
  });

  it("reads the session id from both session cookie formats", () => {
    expect(gaSessionIdFromCookie("GS1.1.1700000000.3.1.1700000100.0.0.0")).toBe("1700000000");
    expect(gaSessionIdFromCookie("GS2.1.s1763550000$o2$g1$t1763550100$j60$l0$h0")).toBe("1763550000");
    expect(gaSessionIdFromCookie("GS2.1.x1$o1")).toBeNull();
    expect(gaSessionIdFromCookie(null)).toBeNull();
  });

  it("derives the session cookie name from the measurement id", () => {
    expect(gaSessionCookieName("G-E4WLY812HF")).toBe("_ga_E4WLY812HF");
  });
});
