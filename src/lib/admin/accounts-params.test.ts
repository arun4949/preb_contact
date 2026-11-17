import { describe, expect, it } from "vitest";
import { isUuid, parseAccountDetailParams, parseAccountsParams, totalPages } from "./accounts-params";

describe("parseAccountsParams", () => {
  it("uses the defaults for an empty query string", () => {
    expect(parseAccountsParams({})).toEqual({ q: "", filter: "all", sort: "created", dir: "desc", page: 1 });
  });

  it("keeps known values", () => {
    expect(parseAccountsParams({ q: " net2source ", filter: "spend", sort: "spent", dir: "asc", page: "3" })).toEqual({
      q: "net2source",
      filter: "spend",
      sort: "spent",
      dir: "asc",
      page: 3,
    });
  });

  it("falls back for unknown or hostile values", () => {
    const parsed = parseAccountsParams({ filter: "everyone", sort: "email; drop table", dir: "sideways", page: "-4" });
    expect(parsed).toEqual({ q: "", filter: "all", sort: "created", dir: "desc", page: 1 });
    expect(parseAccountsParams({ page: "0" }).page).toBe(1);
    expect(parseAccountsParams({ page: "2.5" }).page).toBe(1);
    expect(parseAccountsParams({ page: "abc" }).page).toBe(1);
  });

  it("reads the first value of a repeated key and caps the search length", () => {
    expect(parseAccountsParams({ q: ["first", "second"] }).q).toBe("first");
    expect(parseAccountsParams({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("parseAccountDetailParams", () => {
  it("uses the defaults", () => {
    expect(parseAccountDetailParams({})).toEqual({ tab: "lists", ws: null, listsPage: 1, ledgerPage: 1, source: "all", status: "all" });
  });

  it("keeps known values and a well-formed workspace id", () => {
    const ws = "01ae8a6d-328d-46ba-9a2a-316903b8ab61";
    expect(parseAccountDetailParams({ tab: "billing", ws, lists: "2", ledger: "4", source: "mcp", status: "attention" })).toEqual({
      tab: "billing",
      ws,
      listsPage: 2,
      ledgerPage: 4,
      source: "mcp",
      status: "attention",
    });
  });

  it("drops a workspace id that is not a uuid and unknown filters", () => {
    const parsed = parseAccountDetailParams({ tab: "secrets", ws: "1 or 1=1", source: "api", status: "weird" });
    expect(parsed.tab).toBe("lists");
    expect(parsed.ws).toBeNull();
    expect(parsed.source).toBe("all");
    expect(parsed.status).toBe("all");
  });
});

describe("helpers", () => {
  it("recognises uuids", () => {
    expect(isUuid("671bfcfe-2b4f-4bc1-b229-3405816b88c9")).toBe(true);
    expect(isUuid("671bfcfe")).toBe(false);
    expect(isUuid("")).toBe(false);
  });

  it("always has at least one page", () => {
    expect(totalPages(0, 25)).toBe(1);
    expect(totalPages(25, 25)).toBe(1);
    expect(totalPages(26, 25)).toBe(2);
  });
});
