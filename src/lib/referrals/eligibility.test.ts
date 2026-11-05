import { describe, expect, it } from "vitest";
import { decideAttribution, FRESH_ACCOUNT_MS, type AttributionInput } from "./eligibility";

const NOW = Date.parse("2026-11-05T12:00:00Z");

const base: AttributionInput = {
  refereeEmail: "jane@northwind.io",
  refereeCreatedAt: new Date(NOW - 5 * 60_000),
  refereeOwnedWorkspaceId: "ws-referee",
  refereeMemberWorkspaceIds: ["ws-referee"],
  referrerWorkspaceId: "ws-referrer",
  referrerWorkspaceKind: "customer",
  referrerOwnerEmail: "arun@acme.com",
  codeRevokedAt: null,
  tombstoned: false,
  now: NOW,
};

describe("decideAttribution", () => {
  it("accepts a fresh owner from another company", () => {
    expect(decideAttribution(base)).toEqual({ ok: true });
  });
  it("rejects a revoked code first", () => {
    expect(decideAttribution({ ...base, codeRevokedAt: "2026-11-01T00:00:00Z", tombstoned: true })).toEqual({ ok: false, reason: "code_revoked" });
  });
  it("never lets the internal workspace refer", () => {
    expect(decideAttribution({ ...base, referrerWorkspaceKind: "internal" })).toEqual({ ok: false, reason: "referrer_internal" });
  });
  it("ignores accounts older than an hour", () => {
    expect(decideAttribution({ ...base, refereeCreatedAt: new Date(NOW - FRESH_ACCOUNT_MS - 1) })).toEqual({ ok: false, reason: "stale_account" });
  });
  it("rejects invitees without a workspace of their own", () => {
    expect(decideAttribution({ ...base, refereeOwnedWorkspaceId: null, refereeMemberWorkspaceIds: ["ws-other"] })).toEqual({ ok: false, reason: "not_owner" });
  });
  it("rejects members of the referrer's workspace and the referrer's own workspace", () => {
    expect(decideAttribution({ ...base, refereeMemberWorkspaceIds: ["ws-referee", "ws-referrer"] })).toEqual({ ok: false, reason: "same_workspace" });
    expect(decideAttribution({ ...base, refereeOwnedWorkspaceId: "ws-referrer" })).toEqual({ ok: false, reason: "same_workspace" });
  });
  it("rejects the referrer's own address, in any case", () => {
    expect(decideAttribution({ ...base, refereeEmail: "Arun@ACME.com" })).toEqual({ ok: false, reason: "self_referral" });
  });
  it("rejects a second account on the referrer's company domain", () => {
    expect(decideAttribution({ ...base, refereeEmail: "sales@acme.com" })).toEqual({ ok: false, reason: "same_domain" });
  });
  it("lets two different people on a free-mail domain through", () => {
    expect(decideAttribution({ ...base, referrerOwnerEmail: "arun@gmail.com", refereeEmail: "jane@gmail.com" })).toEqual({ ok: true });
  });
  it("rejects a recreated account", () => {
    expect(decideAttribution({ ...base, tombstoned: true })).toEqual({ ok: false, reason: "recreated_account" });
  });
});
