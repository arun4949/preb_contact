import { describe, expect, it } from "vitest";
import { hasConsent, isClickContextFresh, META_CLICK_CONTEXT_DAYS, mergeClickContext, type StoredClickContext } from "./click-context";

const stored: StoredClickContext = { fbc: "fb.1.1700000000000.click", fbp: "fb.1.1700000000000.123", clientIp: "10.0.0.1", userAgent: "InAppBrowser", capturedAt: new Date().toISOString() };
const emptyRequest = { fbp: null, fbc: null, clientIp: null, userAgent: null };

describe("stored click context", () => {
  it("is fresh inside the window and stale after it", () => {
    const now = Date.parse("2026-11-09T12:00:00Z");
    expect(isClickContextFresh(new Date(now - 10 * 86_400_000).toISOString(), now)).toBe(true);
    expect(isClickContextFresh(new Date(now - (META_CLICK_CONTEXT_DAYS + 1) * 86_400_000).toISOString(), now)).toBe(false);
    expect(isClickContextFresh("not a date", now)).toBe(false);
  });

  it("counts a stored row as consent when the request has no consent cookie", () => {
    expect(hasConsent({ consent: false }, null)).toBe(false);
    expect(hasConsent({ consent: false }, stored)).toBe(true);
    expect(hasConsent({ consent: true }, null)).toBe(true);
  });

  it("fills the identifiers a browser switch lost, keeping the current browser's ip and agent", () => {
    const merged = mergeClickContext({ fbp: null, fbc: null, clientIp: "203.0.113.9", userAgent: "Safari" }, stored);
    expect(merged).toEqual({ fbp: stored.fbp, fbc: stored.fbc, clientIp: "203.0.113.9", userAgent: "Safari" });
  });

  it("lets request values win over stored ones (same browser or a newer click)", () => {
    const merged = mergeClickContext({ fbp: "fb.1.2.new", fbc: "fb.1.2.newclick", clientIp: "1.1.1.1", userAgent: "Chrome" }, stored);
    expect(merged).toEqual({ fbp: "fb.1.2.new", fbc: "fb.1.2.newclick", clientIp: "1.1.1.1", userAgent: "Chrome" });
  });

  it("falls back to stored ip and agent when the request has none (webhook)", () => {
    expect(mergeClickContext(emptyRequest, stored)).toEqual({ fbp: stored.fbp, fbc: stored.fbc, clientIp: "10.0.0.1", userAgent: "InAppBrowser" });
    expect(mergeClickContext(emptyRequest, null)).toEqual(emptyRequest);
  });
});
