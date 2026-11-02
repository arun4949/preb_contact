# MCP server (AI assistants)

Preb is a remote MCP server at `https://app.preb.co/mcp` so that users can enrich contacts from Claude, ChatGPT, Claude Code and any other MCP client. Shipped 2026-11-02. This note is for us; the user-facing guides live in the help center (`src/lib/docs/content/integrations.ts`).

## How it fits together

```
assistant ──(OAuth 2.1: DCR + PKCE)──► Supabase Auth  ──► app.preb.co/oauth/consent (our page: pick workspace, Allow)
assistant ──Bearer <Supabase JWT>──► app.preb.co/mcp ──► jose verifies against the project JWKS (ES256, needs `client_id`)
                                                      ──► mcp_connections (user, client) → workspace, membership check
                                                      ──► insertContacts + queueList (the normal engine)
```

- **Authorization server:** Supabase Auth's OAuth 2.1 server (beta). Dashboard: Authentication > OAuth Server: enabled, Authorization Path `/oauth/consent`, dynamic client registration on. Site URL (Authentication > URL Configuration) must be `https://app.preb.co`, because Supabase builds the consent URL from it. Discovery: `https://<ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`.
- **Protected resource metadata:** `/.well-known/oauth-protected-resource/mcp` (path-specific, Claude probes it first) and `/.well-known/oauth-protected-resource` (root fallback). Both say `authorization_servers: ["https://<ref>.supabase.co/auth/v1"]`. The `401` from `/mcp` carries `WWW-Authenticate: Bearer … resource_metadata="…"`.
- **Token check** (`src/lib/mcp/auth.ts`): ES256, issuer `<SUPABASE_URL>/auth/v1`, `sub` and `client_id` required. A user's own session JWT has no `client_id` and is rejected, so a leaked cookie cannot drive the server.
- **Workspace** (`src/lib/mcp/context.ts`): `mcp_connections(user_id, client_id)` written on consent and required on every call (no fallback: a disconnected assistant must stop at once even though its access token is valid for up to an hour); membership checked on every call. `tool_calls` and `last_used_at` are bumped in `after()`.
- **Transport:** streamable HTTP, stateless (`mcp-handler` 2.x, no Redis). `maxDuration = 60`; `enrich_contacts` waits at most 55 s.
- **Dynamic client registration (DCR) risk:** anyone can register a client named "Claude". The consent page judges the redirect host, not the name (`isKnownRedirectHost`): claude.ai, claude.com, chatgpt.com, openai.com and loopback are fine, anything else shows an "Unknown app" warning. Tokens expire after one hour, Disconnect revokes at once.
- **Proxy:** `/mcp`, `/mcp/` and `/.well-known/` are public and sessionless. `/oauth/consent` is protected, so a signed-out user bounces through `/login?next=…` and back.

## Tools (`src/lib/mcp/tools/`)

| Tool | Spends credits | Notes |
|---|---|---|
| `check_credits` | no | balance, plan, renewal, overspend state, cost table |
| `estimate_enrichment` | no | same normaliser as the app; cache hits counted with `lookupCache` + `countCacheHits` (shared with `insertContacts`) |
| `enrich_contacts` | yes | ≤ 100 people, `wait_seconds` 0 to 55 (default 45). Creates a `lists` row with `source = 'mcp'`, `source_detail = <assistant>`, then `insertContacts` + `queueList({ reverseLookup })`. Abuse guard: 10 runs per minute per user. |
| `get_enrichment_results` | no | any run of the workspace, 1,000 contacts max |
| `list_enrichment_runs` | no | newest first, csv + manual + mcp |
| `search` / `fetch` | no | ChatGPT compatibility pair over already enriched contacts (`structuredContent` per OpenAI's schema) |

The server `instructions` tell the assistant to estimate first and get the user's confirmation. The server never blocks spend itself (same as FullEnrich).

Copy rules apply: the provider is never named, email levels are Valid / Probably valid / Catch-all, no dashes as punctuation.

## Data

- Migration `0029_mcp.sql`: `mcp_connections` (RLS: own rows select/delete, writes service role), `lists.source` check extended to `'mcp'` (NOT VALID + VALIDATE, no long lock), `lists.source_detail`.
- The Enrich tab shows `source in ('manual','mcp')` with a "via Claude" chip (`HistoryRow.via`); the Lists tab keeps `source = 'csv'`.
- Disconnect (`src/lib/mcp/actions.ts`): `supabase.auth.oauth.revokeGrant({ clientId })` + delete the row. Tokens of that client stop working at once.

## UI

- Header tab **Integrations** (`/integrations`): feature card with a chat mock, assistant cards (Claude, ChatGPT, Other) with Connected state and Disconnect, "Suggest an integration".
- `/integrations/ai-assistants`: copyable address, three-step strip, per-assistant setup guides (open the help articles in a new tab), copyable prompts, "Good to know".
- `/oauth/consent`: assistant logo + Preb mark, what it can do, workspace select (only when the user has several), Allow / Cancel. Already-consented clients are redirected straight back by Supabase.
- `/admin/ops`: "AI assistants" stat (connections, active 24 h, runs 24 h).

## Testing

- Unit: `src/lib/mcp/*.test.ts` (token verification with a generated ES256 key and an msw JWKS, contact normalisation, assistant detection, result formatting), proxy allowlist, docs lint.
- Without the Supabase OAuth server enabled you can only test the `401` challenge and the metadata (curl). With it on:
  1. `POST https://<ref>.supabase.co/auth/v1/oauth/clients/register` (DCR) with a `http://127.0.0.1:<port>/callback` redirect, open `…/auth/v1/oauth/authorize?response_type=code&client_id=…&redirect_uri=…&code_challenge=…&code_challenge_method=S256&scope=email`, approve on the consent page, exchange the code at `…/auth/v1/oauth/token` (form-encoded), call `/mcp` with the access token. The scratchpad walk of 2026-11-02 did exactly this (`oauth-walk.mjs`).
  2. Real clients: add `https://app.preb.co/mcp` as a custom connector in Claude (Customize > Connectors) and as a custom MCP server in ChatGPT (Developer mode), run "Check my Preb credits".
- Debugging a failed connection: check the `401` header on `/mcp` (must point at the metadata), fetch the metadata, fetch the Supabase discovery document (404 `feature_disabled` means the toggle is off), look for `scope: "mcp"` log lines in Vercel.

## Not done on purpose

- No API keys / static headers: Claude's request-header auth is a limited beta and ChatGPT does not support keys at all. Tools without a browser (CI, automations) are out of scope until there is demand.
- No people search: Preb has no search API, so the "find me 15 heads of marketing" prompt from competitors does not apply. The tools cover enrich, reverse email, estimate, results and credits.
