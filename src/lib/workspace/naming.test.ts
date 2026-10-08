import { describe, expect, it } from "vitest";
import { suggestWorkspaceName, workspaceSlug } from "./naming";

describe("suggestWorkspaceName", () => {
  it("uses the company part of a work domain", () => {
    expect(suggestWorkspaceName("ada@acme-recruiting.co.uk", "Ada Lovelace")).toBe("Acme-recruiting");
    expect(suggestWorkspaceName("arun@preb.co", null)).toBe("Preb");
  });
  it("falls back to the first name for free-mail addresses", () => {
    expect(suggestWorkspaceName("ada@gmail.com", "Ada Lovelace")).toBe("Ada's workspace");
    expect(suggestWorkspaceName("ada.l@gmx.de", "")).toBe("ada.l's workspace");
  });
});

describe("workspaceSlug", () => {
  it("slugifies and appends the suffix", () => {
    expect(workspaceSlug("Acme Recruiting GmbH", "abc123")).toBe("acme-recruiting-gmbh-abc123");
    expect(workspaceSlug("  Ünïcode!! ", "abc123")).toBe("n-code-abc123");
    expect(workspaceSlug("!!!", "abc123")).toBe("workspace-abc123");
  });
  it("generates a 6-char random suffix by default", () => {
    expect(workspaceSlug("Preb")).toMatch(/^preb-[0-9a-f]{6}$/);
  });
});
