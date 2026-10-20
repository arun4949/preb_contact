import { describe, expect, it } from "vitest";
import { cleanLeadProfileUrl, leadProfileSource } from "./profile-url";

describe("lead profile URL", () => {
  it("keeps normalising LinkedIn profiles like before", () => {
    expect(cleanLeadProfileUrl("https://www.linkedin.com/in/Jane-Doe/")).toBe("https://www.linkedin.com/in/jane-doe");
    expect(cleanLeadProfileUrl("linkedin.com/in/jane")).toBe("https://www.linkedin.com/in/jane");
    expect(cleanLeadProfileUrl("https://www.linkedin.com/sales/lead/ABC")).toBe("https://www.linkedin.com/sales/lead/ABC");
  });

  it("accepts Reddit and other web URLs", () => {
    expect(cleanLeadProfileUrl("https://www.reddit.com/user/jane_doe/")).toBe("https://www.reddit.com/user/jane_doe/");
    expect(cleanLeadProfileUrl("reddit.com/r/recruiting/comments/abc")).toBe("https://reddit.com/r/recruiting/comments/abc");
    expect(cleanLeadProfileUrl("http://x.com/jane")).toBe("https://x.com/jane");
    expect(cleanLeadProfileUrl("  https://jane.dev  ")).toBe("https://jane.dev/");
  });

  it("rejects anything that is not a plain web URL", () => {
    for (const bad of ["", "   ", "jane", "javascript:alert(1)", "data:text/html,hi", "mailto:jane@acme.com", "ftp://acme.com", "https://localhost", "jane doe.com", `https://a.com/${"x".repeat(300)}`]) {
      expect(cleanLeadProfileUrl(bad)).toBeNull();
    }
  });

  it("detects the source for the icon", () => {
    expect(leadProfileSource("https://www.linkedin.com/in/jane")).toBe("linkedin");
    expect(leadProfileSource("https://old.reddit.com/user/jane")).toBe("reddit");
    expect(leadProfileSource("https://x.com/jane")).toBe("other");
    expect(leadProfileSource("not a url")).toBe("other");
  });
});
