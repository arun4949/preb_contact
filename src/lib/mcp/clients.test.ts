import { describe, expect, it } from "vitest";
import { assistantBadge, assistantFromClientName, isKnownRedirectHost } from "./clients";
import { PUBLIC_MCP_URL, mcpServerUrl, publicMcpServerUrl } from "./config";

describe("assistant detection", () => {
  it("maps the names MCP clients register with", () => {
    expect(assistantFromClientName("Claude").id).toBe("claude");
    expect(assistantFromClientName("claude-code").id).toBe("claude");
    expect(assistantFromClientName("Anthropic Claude Desktop").id).toBe("claude");
    expect(assistantFromClientName("ChatGPT").id).toBe("chatgpt");
    expect(assistantFromClientName("OpenAI Connector").id).toBe("chatgpt");
    expect(assistantFromClientName("Cursor").id).toBe("other");
    expect(assistantFromClientName(null).name).toBe("AI assistant");
  });

  it("builds the Enrich tab badge", () => {
    expect(assistantBadge("Claude")).toBe("via Claude");
    expect(assistantBadge(null)).toBeNull();
  });

  it("keeps the public address on production, whatever the local origin is", () => {
    expect(publicMcpServerUrl()).toBe(PUBLIC_MCP_URL);
    expect(PUBLIC_MCP_URL).toBe("https://app.preb.co/mcp");
    expect(mcpServerUrl("http://localhost:3000/")).toBe("http://localhost:3000/mcp");
  });
});

describe("redirect host check (phishing guard on the consent page)", () => {
  it("knows the assistants' own domains and loopback addresses", () => {
    for (const h of ["claude.ai", "www.claude.ai", "chatgpt.com", "localhost:3118", "127.0.0.1:52000"]) expect(isKnownRedirectHost(h), h).toBe(true);
    for (const h of ["claude.ai.evil.com", "evilclaude.ai", "example.com", "", null]) expect(isKnownRedirectHost(h), String(h)).toBe(false);
  });
});
