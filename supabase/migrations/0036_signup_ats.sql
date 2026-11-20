-- 0036: self-reported ATS. New workspace owners get a second optional question
-- after "How did you first hear about Preb?": "Which ATS do you use?" (third
-- onboarding step). It tells us which tools our customers work with. Additive
-- only: one table and one function (dev and production share this database).
-- `signup_sources` and `admin_signup_sources` (0035) are not touched: their
-- checks tie `status` to `source`, so a second answer gets its own row.
--
-- One row per asked person, created as `pending` together with the
-- `signup_sources` row when the owner finishes step 1. No row = never asked
-- (accounts from before this feature and invited teammates). `pending` that
-- never changes = the person left without answering or skipping. Nothing in
-- the app gates on this table.
--
-- Service role only (RLS on, no policies): written by server actions, read by
-- the admin pages. The account deletion cascades.
--
-- `ats` holds an option key from src/lib/onboarding/signup-ats.ts. The list is
-- deliberately not a check constraint, so options can change without a
-- migration; only the shape is checked. `detail` is the optional free text of
-- the "Other" option.

create table public.signup_ats (
  user_id uuid primary key
    constraint signup_ats_user_id_fkey references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'answered', 'skipped')),
  ats text check (ats is null or ats ~ '^[a-z_]{1,40}$'),
  detail text check (detail is null or char_length(detail) <= 200),
  asked_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint signup_ats_answered_has_ats check ((status = 'answered') = (ats is not null)),
  constraint signup_ats_detail_needs_answer check (detail is null or status = 'answered')
);
comment on table public.signup_ats is
  'Self-reported ATS from the optional third onboarding step. One row per asked workspace owner (pending, answered or skipped); no row means never asked. Service role only.';
create index signup_ats_asked_at_idx on public.signup_ats (asked_at desc);
alter table public.signup_ats enable row level security;

-- One row per asked person for the ATS view of /admin/insights, with the
-- workspace they own (plan, credits spent). Same workspace rule and the same
-- stable order as admin_signup_sources (0035): the owned workspace, customer
-- first, then the oldest. Aggregation happens in the app.
create function public.admin_signup_ats(
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  status text,
  ats text,
  detail text,
  asked_at timestamptz,
  responded_at timestamptz,
  workspace_id uuid,
  workspace_name text,
  owns_internal boolean,
  plan_key text,
  subscription_status text,
  trial_granted_at timestamptz,
  credits_spent integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with asked as (
    select s.*
    from public.signup_ats s
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
    a.status,
    a.ats,
    a.detail,
    a.asked_at,
    a.responded_at,
    o.id,
    o.name,
    exists (select 1 from public.workspaces i where i.owner_id = a.user_id and i.kind = 'internal'),
    o.plan_key,
    o.subscription_status,
    o.trial_granted_at,
    coalesce(sp.spent, 0)
  from asked a
  join public.profiles p on p.id = a.user_id
  left join owned o on o.owner_user_id = a.user_id
  left join spend sp on sp.workspace_id = o.id
  order by a.asked_at desc, a.user_id;
$$;
comment on function public.admin_signup_ats(timestamptz, timestamptz) is
  'Admin only. One row per person asked which ATS they use, with the owned workspace (plan, credits spent via admin_workspace_spend). Newest first.';
revoke execute on function public.admin_signup_ats(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_signup_ats(timestamptz, timestamptz) to service_role;
