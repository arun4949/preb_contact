-- 0035: self-reported acquisition source. New workspace owners get one optional
-- question after the onboarding card ("How did you first hear about Preb?").
-- Tracked attribution (Meta click context, referral, lead magnet) misses word
-- of mouth, AI assistants, communities and anything opened in another browser;
-- the answer fills that gap. Additive only: one table and one function (dev and
-- production share this database).
--
-- One row per asked person, created as `pending` by the onboarding action when
-- the owner finishes step 1. No row = never asked (accounts from before this
-- feature and invited teammates). `pending` that never changes = the person
-- left without answering or skipping. Nothing in the app gates on this table.
--
-- Not on `profiles`: profile rows are readable by workspace co-members.
-- Service role only (RLS on, no policies): written by server actions, read by
-- the admin pages. The account deletion cascades.
--
-- `source` holds an option key from src/lib/onboarding/signup-source.ts. The
-- list is deliberately not a check constraint, so options can change without a
-- migration; only the shape is checked. `options_shown` and `shown_position`
-- record the shuffled order the person saw, to measure position bias.
-- `meta_attribution` is the Meta verdict at the time of asking (ad_click,
-- cookie_only, none): a category only, never an identifier, kept because
-- `meta_click_contexts` rows are deleted after 90 days.

create table public.signup_sources (
  user_id uuid primary key
    constraint signup_sources_user_id_fkey references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'answered', 'skipped')),
  source text check (source is null or source ~ '^[a-z_]{1,40}$'),
  detail text check (detail is null or char_length(detail) <= 200),
  options_shown text[],
  shown_position smallint check (shown_position is null or shown_position between 1 and 50),
  meta_attribution text check (meta_attribution is null or meta_attribution in ('ad_click', 'cookie_only', 'none')),
  asked_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint signup_sources_answered_has_source check ((status = 'answered') = (source is not null)),
  constraint signup_sources_detail_needs_answer check (detail is null or status = 'answered')
);
comment on table public.signup_sources is
  'Self-reported acquisition source from the optional second onboarding step. One row per asked workspace owner (pending, answered or skipped); no row means never asked. Service role only.';
create index signup_sources_asked_at_idx on public.signup_sources (asked_at desc);
alter table public.signup_sources enable row level security;

-- One row per asked person for /admin/sources, with what the page compares the
-- answer against: the workspace they own (plan, credits spent) and the tracked
-- attribution (Meta verdict stored with the row, referral, lead magnet).
-- The workspace is the one the person owns, not `profiles.default_workspace_id`
-- (accepting an invite repoints that). Customer workspaces come first, then the
-- oldest. Aggregation happens in the app; the stable order lets the loader page
-- past the 1000-row response cap.
create function public.admin_signup_sources(
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  signed_up_at timestamptz,
  onboarded_at timestamptz,
  status text,
  source text,
  detail text,
  shown_position smallint,
  options_count integer,
  asked_at timestamptz,
  responded_at timestamptz,
  workspace_id uuid,
  workspace_name text,
  owns_internal boolean,
  plan_key text,
  subscription_status text,
  trial_granted_at timestamptz,
  credits_spent integer,
  meta_attribution text,
  referral_status text,
  from_lead_share boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with asked as (
    select s.*
    from public.signup_sources s
    where (p_since is null or s.asked_at >= p_since)
      and (p_until is null or s.asked_at < p_until)
  ),
  owned as (
    select a.user_id as owner_user_id, w.id, w.name, w.plan_key, w.subscription_status, w.trial_granted_at
    from asked a
    left join lateral (
      select x.id, x.name, x.plan_key, x.subscription_status, x.trial_granted_at
      from public.workspaces x
      where x.owner_id = a.user_id
      order by (x.kind = 'customer') desc, x.created_at, x.id
      limit 1
    ) w on true
  ),
  spend as (
    select sp.workspace_id, sp.spent
    from public.admin_workspace_spend(
      (select coalesce(array_agg(o.id) filter (where o.id is not null), '{}') from owned o)
    ) sp
  )
  select
    a.user_id,
    p.email,
    p.full_name,
    p.created_at,
    p.onboarded_at,
    a.status,
    a.source,
    a.detail,
    a.shown_position,
    coalesce(cardinality(a.options_shown), 0),
    a.asked_at,
    a.responded_at,
    o.id,
    o.name,
    exists (select 1 from public.workspaces i where i.owner_id = a.user_id and i.kind = 'internal'),
    o.plan_key,
    o.subscription_status,
    o.trial_granted_at,
    coalesce(sp.spent, 0),
    a.meta_attribution,
    (select r.status from public.referrals r where r.referred_user_id = a.user_id),
    exists (select 1 from public.lead_shares ls where ls.signed_up_user_id = a.user_id)
  from asked a
  join public.profiles p on p.id = a.user_id
  left join owned o on o.owner_user_id = a.user_id
  left join spend sp on sp.workspace_id = o.id
  order by a.asked_at desc, a.user_id;
$$;
comment on function public.admin_signup_sources(timestamptz, timestamptz) is
  'Admin only. One row per person asked for their acquisition source, with the owned workspace (plan, credits spent via admin_workspace_spend) and the tracked attribution (Meta verdict, referral status, lead magnet). Newest first.';
revoke execute on function public.admin_signup_sources(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_signup_sources(timestamptz, timestamptz) to service_role;
