-- 0029: MCP server (AI assistants). An AI tool such as Claude or ChatGPT signs
-- in through Supabase Auth's OAuth 2.1 server; the consent page records which
-- workspace the connection works in. Enrichment runs started from an assistant
-- are normal lists with source = 'mcp' (shown in the Enrich tab with a badge).
-- Everything here is additive and inert until the OAuth server is switched on.

create table public.mcp_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 200),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_name text not null default '' check (char_length(client_name) <= 120),
  tool_calls integer not null default 0 check (tool_calls >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
comment on table public.mcp_connections is
  'One row per AI assistant (OAuth client) a user connected to Preb, with the workspace it works in. Written by the service role on consent and on tool calls.';
create index mcp_connections_workspace_id_idx on public.mcp_connections (workspace_id);
create trigger mcp_connections_updated_at before update on public.mcp_connections
  for each row execute function public.set_updated_at();

alter table public.mcp_connections enable row level security;
-- A user sees and removes their own connections; the service role writes them.
create policy mcp_connections_select on public.mcp_connections for select to authenticated
  using (user_id = (select auth.uid()));
create policy mcp_connections_delete on public.mcp_connections for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update on public.mcp_connections from authenticated, anon;

-- Lists started from an assistant. The constraint swap is NOT VALID + VALIDATE
-- so the table is never locked for a full scan; every existing row already
-- satisfies the wider check.
alter table public.lists drop constraint lists_source_check;
alter table public.lists add constraint lists_source_check
  check (source in ('csv', 'manual', 'mcp')) not valid;
alter table public.lists validate constraint lists_source_check;

alter table public.lists add column source_detail text
  check (source_detail is null or char_length(source_detail) <= 120);
comment on column public.lists.source_detail is
  'For source = mcp: the name of the AI assistant that started the run (badge in the Enrich tab).';
