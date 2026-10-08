-- Day 7 QA: covering indexes for foreign keys the performance advisor flagged.
create index if not exists email_sends_workspace_id_idx on public.email_sends (workspace_id);
create index if not exists enrichment_cache_source_workspace_id_idx on public.enrichment_cache (source_workspace_id);
create index if not exists lists_created_by_idx on public.lists (created_by);
create index if not exists workspace_invites_invited_by_idx on public.workspace_invites (invited_by);
