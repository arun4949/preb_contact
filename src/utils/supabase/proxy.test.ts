import { describe, expect, it } from "vitest";
import { isPublic, isSessionless } from "./proxy";

describe("isPublic", () => {
  it("opens sign-in, auth callbacks, invites, webhooks, cron and samples", () => {
    for (const p of ["/login", "/auth/confirm", "/auth/callback", "/invite/abc", "/api/webhooks/stripe", "/api/jobs/tick", "/samples/contacts-template.csv", "/robots.txt", "/sitemap.xml", "/terms", "/privacy", "/docs", "/docs/billing", "/docs/billing/how-credits-work", "/docs/contact"]) {
      expect(isPublic(p), p).toBe(true);
    }
  });
  it("keeps the app private, including the root", () => {
    for (const p of ["/", "/lists", "/lists/new", "/enrich", "/onboarding", "/admin/ops", "/api/lists", "/pricing", "/docsx", "/documents", "/loginx"]) {
      expect(isPublic(p), p).toBe(false);
    }
  });
  it("skips the session refresh on static public pages only", () => {
    for (const p of ["/docs", "/docs/lists/stop-a-list", "/sitemap.xml", "/api/webhooks/stripe"]) expect(isSessionless(p), p).toBe(true);
    for (const p of ["/login", "/lists", "/invite/abc", "/docsx"]) expect(isSessionless(p), p).toBe(false);
  });
});
