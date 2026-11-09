-- 0033: Meta Ads click context. A mobile lead clicks an ad in the Meta in-app
-- browser, requests a sign-in link there and opens it in Safari: the second
-- browser has neither the `_fbc`/`_fbp` cookies nor the advertising consent
-- cookie, so the CompleteRegistration (and later Purchase) server events reach
-- Meta without the click id and cannot be attributed to the ad. Meta's
-- Conversions API documentation allows storing the formatted click id in
-- backend storage and sending it with later events.
--
-- One row per account, written server-side only when the capturing request
-- carried the advertising consent cookie (no row = no consent), at account
-- creation (magic-link request or Google callback). Read by the onboarding
-- action and the Stripe webhook. Service role only (RLS on, no policies).
-- Rows older than 90 days are deleted by the daily job; the account deletion
-- cascades.

create table public.meta_click_contexts (
  user_id uuid primary key
    constraint meta_click_contexts_user_id_fkey references public.profiles (id) on delete cascade,
  fbc text check (fbc is null or char_length(fbc) <= 512),
  fbp text check (fbp is null or char_length(fbp) <= 128),
  client_ip text check (client_ip is null or char_length(client_ip) <= 64),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  source text not null check (source in ('magic_link', 'oauth')),
  captured_at timestamptz not null default now()
);
comment on table public.meta_click_contexts is
  'Meta click id and browser identifiers captured with advertising consent when the account was created; attached to later Conversions API events (CompleteRegistration, Purchase). Service role only; rows expire after 90 days.';
create index meta_click_contexts_captured_at_idx on public.meta_click_contexts (captured_at);
alter table public.meta_click_contexts enable row level security;
