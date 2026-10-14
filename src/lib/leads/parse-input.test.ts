import { describe, expect, it } from "vitest";
import { parsePastedContacts, normalisePasted } from "./parse-input";

describe("parsePastedContacts", () => {
  it("reads LinkedIn URLs, comma, @ and whitespace separated names with domains", () => {
    const { cells, rejected, truncated } = parsePastedContacts(
      ["https://www.linkedin.com/in/Jane-Doe/", "John Smith, acme.com", "Maria Garcia @ https://www.globex.io/about", "Ada Lovelace analytical.co.uk", "", "   "].join("\n"),
    );
    expect(cells).toEqual([
      ["", "", "", "https://www.linkedin.com/in/jane-doe"],
      ["John", "Smith", "acme.com", ""],
      ["Maria", "Garcia", "globex.io", ""],
      ["Ada", "Lovelace", "analytical.co.uk", ""],
    ]);
    expect(rejected).toEqual([]);
    expect(truncated).toBe(false);
  });

  it("rejects lines without a usable person and reports them", () => {
    const { cells, rejected } = parsePastedContacts(["just a name", "acme.com", "Jane Doe, not a domain"].join("\n"));
    expect(cells).toEqual([]);
    expect(rejected).toHaveLength(3);
  });

  it("caps the rows and flags the overflow", () => {
    const lines = Array.from({ length: 55 }, (_, i) => `Person Number${i}, company${i}.com`);
    const { cells, truncated } = parsePastedContacts(lines.join("\n"));
    expect(cells).toHaveLength(50);
    expect(truncated).toBe(true);
  });

  it("normalises through the manual mapping", () => {
    const { rows, summary } = normalisePasted(parsePastedContacts("John Smith, acme.com\nhttps://linkedin.com/in/jane").cells);
    expect(summary.enrichable).toBe(2);
    expect(rows[0].domain).toBe("acme.com");
    expect(rows[1].linkedin_url).toBe("https://www.linkedin.com/in/jane");
  });
});
