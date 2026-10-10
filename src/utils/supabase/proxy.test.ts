import { describe, expect, it } from "vitest";
import { isPublic } from "./proxy";

describe("isPublic", () => {
  it("opens sign-in, auth callbacks, invites, webhooks, cron and samples", () => {
    for (const p of ["/login", "/auth/confirm", "/auth/callback", "/invite/abc", "/api/webhooks/stripe", "/api/jobs/tick", "/samples/contacts-template.csv", "/robots.txt", "/terms", "/privacy"]) {
      expect(isPublic(p), p).toBe(true);
    }
  });
  it("keeps the app private, including the root", () => {
    for (const p of ["/", "/lists", "/lists/new", "/enrich", "/onboarding", "/admin/ops", "/api/lists", "/pricing"]) {
      expect(isPublic(p), p).toBe(false);
    }
  });
});
