/**
 * The AI assistants we document. MCP clients register themselves through
 * dynamic client registration with a free-form name; we map that name to the
 * assistant for the badge in the Enrich tab and the Connected state on the
 * Integrations page.
 */
export type AssistantId = "claude" | "chatgpt" | "other";

export interface Assistant {
  id: AssistantId;
  /** Display name, also stored as `lists.source_detail`. */
  name: string;
  /** Docs article slug in the `integrations` collection. */
  guide: string;
}

export const ASSISTANTS: Record<AssistantId, Assistant> = {
  claude: { id: "claude", name: "Claude", guide: "connect-claude" },
  chatgpt: { id: "chatgpt", name: "ChatGPT", guide: "connect-chatgpt" },
  other: { id: "other", name: "AI assistant", guide: "connect-other-ai-tools" },
};

/** Claude registers as "Claude" (claude.ai), "Claude Code" etc.; ChatGPT as "ChatGPT" or "OpenAI …". */
export function assistantFromClientName(clientName: string | null | undefined): Assistant {
  const n = (clientName ?? "").toLowerCase();
  if (n.includes("claude") || n.includes("anthropic")) return ASSISTANTS.claude;
  if (n.includes("chatgpt") || n.includes("openai")) return ASSISTANTS.chatgpt;
  return ASSISTANTS.other;
}

/** "via Claude" badge text, or null for unknown assistants. */
export function assistantBadge(sourceDetail: string | null | undefined): string | null {
  if (!sourceDetail) return null;
  return `via ${sourceDetail}`;
}

/** Hosts an assistant legitimately sends the user back to after consent. */
const KNOWN_REDIRECT_HOSTS = ["claude.ai", "claude.com", "chatgpt.com", "openai.com", "localhost", "127.0.0.1"];

/**
 * Dynamic client registration lets anyone register a client with a friendly
 * name. The consent page therefore judges the redirect host, not the name:
 * Claude and ChatGPT return to their own domains, local tools to a loopback
 * address. Anything else gets a warning before the user approves.
 */
export function isKnownRedirectHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().replace(/:\d+$/, "");
  return KNOWN_REDIRECT_HOSTS.some((k) => h === k || h.endsWith(`.${k}`));
}
