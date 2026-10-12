-- 0020: anonymous "Was this helpful?" votes on help center articles (/docs).
-- Counts only: no user id, no IP address, no cookie. Rows are written by a
-- server action with the service role after it validated the slug against
-- the article registry and applied an in-memory throttle; the publishable
-- key never touches this table (RLS on, no policies).

create table public.docs_feedback (
  id uuid primary key default gen_random_uuid(),
  article_slug text not null check (article_slug ~ '^[a-z0-9-]{1,80}$'),
  helpful boolean not null,
  created_at timestamptz not null default now()
);

comment on table public.docs_feedback is
  'Anonymous helpful / not helpful votes per help center article. Service role only; aggregated on /admin/ops.';

create index docs_feedback_created_at_idx on public.docs_feedback (created_at desc);

alter table public.docs_feedback enable row level security;
