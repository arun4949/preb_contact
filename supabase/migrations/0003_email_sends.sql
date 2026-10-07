-- Outbound transactional email log (Resend). Used to rate-limit sign-in links
-- per address and to audit what we sent. Service role only.
create type public.email_kind as enum (
  'magic_link', 'welcome', 'invite', 'list_finished', 'list_paused', 'credits_low', 'ops_alert'
);

create table public.email_sends (
  id bigint generated always as identity primary key,
  email text not null,
  kind public.email_kind not null,
  provider_message_id text,
  workspace_id uuid references public.workspaces (id) on delete set null,
  sent_at timestamptz not null default now()
);
create index email_sends_email_kind_sent_idx on public.email_sends (lower(email), kind, sent_at desc);

alter table public.email_sends enable row level security;
-- no policies: service role only.
