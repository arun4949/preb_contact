-- Manual enrichment (Enrich tab): a run of hand-typed contacts is stored as a
-- normal list so the engine, cache, counters and export stay unchanged. The
-- source tells the Lists tab to hide these runs; the Enrich tab shows their
-- contacts as a flat history instead.
alter table public.lists
  add column source text not null default 'csv' check (source in ('csv', 'manual'));

create index lists_workspace_source_idx on public.lists (workspace_id, source);
