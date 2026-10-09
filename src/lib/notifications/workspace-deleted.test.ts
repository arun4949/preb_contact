import { describe, expect, it } from "vitest";
import { workspaceDeletedCopy } from "./copy";
import { isNotificationKind } from "./types";

describe("workspaceDeletedCopy", () => {
  it("uses a registered kind and dash-free copy", () => {
    const copy = workspaceDeletedCopy("Acme");
    expect(isNotificationKind(copy.kind)).toBe(true);
    expect(copy.title).toBe("Acme was deleted");
    expect(`${copy.title} ${copy.body}`).not.toMatch(/—|–| - /);
  });
});
