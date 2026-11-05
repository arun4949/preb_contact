-- 0031: referral programme ("Invite friends"). Every workspace owns one share
-- code (app.preb.co/r/<code>). A new account that arrives through the link is
-- recorded as a referral; when that account's workspace pays its first
-- subscription invoice within the window, the referrer's workspace receives
-- free credits (amount and window are env vars read by the app). Both tables
-- are service-role only (RLS on, no policies); the app reads them through
-- server actions. Attribution is written server-side only, never from user
-- metadata.

create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_by uuid references public.profiles (id) on delete set null,
  click_count integer not null default 0 check (click_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.referral_codes is
  'One referral share code per workspace (app.preb.co/r/<code>). Service role only; read through server actions.';
alter table public.referral_codes enable row level security;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.referral_codes (id) on delete cascade,
  referrer_workspace_id uuid not null
    constraint referrals_referrer_workspace_id_fkey references public.workspaces (id) on delete cascade,
  referred_user_id uuid unique
    constraint referrals_referred_user_id_fkey references public.profiles (id) on delete set null,
  referred_workspace_id uuid
    constraint referrals_referred_workspace_id_fkey references public.workspaces (id) on delete set null,
  -- sha256 of the lower-cased email: one reward per person, ever, even after the account was deleted.
  referred_email_hash text not null unique,
  -- 'j***@acme.com', the only form the referrer ever sees.
  referred_email_masked text not null check (char_length(referred_email_masked) <= 254),
  source text not null check (source in ('magic_link', 'oauth', 'onboarding')),
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'expired', 'rejected', 'revoked')),
  rejected_reason text check (rejected_reason is null or rejected_reason in (
    'self_referral', 'same_domain', 'same_workspace', 'not_owner', 'recreated_account',
    'referrer_internal', 'code_revoked', 'stale_account', 'monthly_cap'
  )),
  signed_up_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reward_credits integer check (reward_credits is null or reward_credits > 0),
  stripe_invoice_id text,
  grant_id uuid unique references public.credit_grants (id) on delete set null,
  rewarded_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
    constraint referrals_revoked_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.referrals is
  'A new account that signed up through a referral link. Rejected rows are kept for fraud review and never shown to the referrer. Service role only.';
create index referrals_referrer_created_idx on public.referrals (referrer_workspace_id, created_at desc);
create index referrals_referred_ws_pending_idx on public.referrals (referred_workspace_id) where status = 'pending';
create index referrals_pending_expires_idx on public.referrals (expires_at) where status = 'pending';
create index referrals_referrer_rewarded_idx on public.referrals (referrer_workspace_id, rewarded_at) where status = 'rewarded';
alter table public.referrals enable row level security;

-- Notification kinds ---------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'admin',
  'member_joined', 'member_welcome', 'member_left', 'member_removed', 'role_changed', 'workspace_deleted',
  'list_finished', 'list_stopped', 'list_paused_credits', 'list_paused_upstream', 'list_failed',
  'credits_low', 'credits_granted', 'credits_expiring', 'trial_ending',
  'plan_started', 'plan_changed', 'plan_cancel_scheduled', 'plan_cancel_reverted', 'plan_canceled',
  'overspend_charged', 'overspend_failed',
  'referral_rewarded'
));

-- Reward ----------------------------------------------------------------------
-- Called by the Stripe webhook for every paid subscription invoice. The row
-- lock serialises concurrent deliveries of the same event; the status state
-- machine and the unique grant_id make a second reward impossible. Amount,
-- expiry and cap are parameters so the env vars stay in the app.
create or replace function public.reward_referral(
  p_referred_workspace_id uuid,
  p_stripe_invoice_id text,
  p_amount integer,
  p_expires_at timestamptz,
  p_monthly_cap integer
) returns table (outcome text, referral_id uuid, referrer_workspace_id uuid, grant_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_gid uuid;
  v_kind text;
  v_recent integer;
begin
  select * into r from public.referrals
    where referred_workspace_id = p_referred_workspace_id and status in ('pending', 'rewarded')
    order by created_at
    limit 1
    for update;
  if not found then
    return query select 'none'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;
  if r.status = 'rewarded' then
    return query select 'already_rewarded'::text, r.id, r.referrer_workspace_id, r.grant_id;
    return;
  end if;
  if r.expires_at < now() then
    update public.referrals set status = 'expired' where id = r.id;
    return query select 'expired'::text, r.id, r.referrer_workspace_id, null::uuid;
    return;
  end if;
  select kind into v_kind from public.workspaces where id = r.referrer_workspace_id;
  if v_kind is null or v_kind = 'internal' or r.referrer_workspace_id = p_referred_workspace_id then
    update public.referrals set status = 'rejected', rejected_reason = 'referrer_internal' where id = r.id;
    return query select 'ineligible'::text, r.id, r.referrer_workspace_id, null::uuid;
    return;
  end if;
  select count(*) into v_recent from public.referrals
    where referrer_workspace_id = r.referrer_workspace_id
      and status = 'rewarded'
      and rewarded_at > now() - interval '30 days';
  if v_recent >= p_monthly_cap then
    update public.referrals
      set status = 'rejected', rejected_reason = 'monthly_cap', stripe_invoice_id = p_stripe_invoice_id
      where id = r.id;
    return query select 'cap_reached'::text, r.id, r.referrer_workspace_id, null::uuid;
    return;
  end if;
  -- No invoice id on the grant: credit_grants.stripe_invoice_id is unique and
  -- the referee's own plan grant already carries this invoice.
  v_gid := public.grant_credits(r.referrer_workspace_id, p_amount, 'referral', p_expires_at, null, 'Referral reward');
  update public.referrals
    set status = 'rewarded', rewarded_at = now(), reward_credits = p_amount,
        stripe_invoice_id = p_stripe_invoice_id, grant_id = v_gid
    where id = r.id;
  return query select 'rewarded'::text, r.id, r.referrer_workspace_id, v_gid;
end;
$$;
revoke execute on function public.reward_referral(uuid, text, integer, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.reward_referral(uuid, text, integer, timestamptz, integer) to service_role;

-- Revoke (admins, /admin/referrals) --------------------------------------------
-- Removes only what is still unused: the grant's remaining credits go to zero
-- with an 'adjust' ledger row. Returns the credits removed.
create or replace function public.revoke_referral_reward(p_referral_id uuid, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_left integer := 0;
begin
  select * into r from public.referrals where id = p_referral_id for update;
  if not found or r.status <> 'rewarded' then
    return 0;
  end if;
  if r.grant_id is not null then
    select remaining into v_left from public.credit_grants where id = r.grant_id for update;
    v_left := coalesce(v_left, 0);
    if v_left > 0 then
      update public.credit_grants set remaining = 0 where id = r.grant_id;
      insert into public.credit_ledger (workspace_id, grant_id, kind, delta, note)
        values (r.referrer_workspace_id, r.grant_id, 'adjust', -v_left, 'Referral reward revoked');
    end if;
  end if;
  update public.referrals
    set status = 'revoked', revoked_at = now(), revoked_by = p_actor
    where id = p_referral_id;
  return v_left;
end;
$$;
revoke execute on function public.revoke_referral_reward(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_referral_reward(uuid, uuid) to service_role;
