-- 0001_schema.sql — Preb enrichment MVP schema
-- Tables, RLS, helpers, signup trigger, credit functions, counters trigger,
-- storage bucket, realtime publication. Applied via Supabase MCP on day 1.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.list_status as enum (
  'draft', 'queued', 'enriching', 'paused_credits', 'paused_upstream',
  'stopping', 'stopped', 'completed', 'failed'
);
create type public.list_mode as enum ('enrich', 'reverse');
create type public.contact_status as enum (
  'pending', 'cached', 'submitted', 'enriched', 'not_found', 'skipped', 'failed'
);
create type public.batch_status as enum (
  'submitted', 'finished', 'credits_insufficient', 'canceled', 'failed'
);
create type public.grant_source as enum ('trial', 'subscription', 'manual');
create type public.ledger_kind as enum ('grant', 'consume', 'expire', 'adjust');

-- ---------------------------------------------------------------------------
-- Utility: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique,
  owner_id uuid not null references auth.users (id) on delete restrict,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_key text,
  current_period_end timestamptz,
  trial_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspaces_owner_id_idx on public.workspaces (owner_id);
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  default_workspace_id uuid references public.workspaces (id) on delete set null,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create index profiles_default_workspace_id_idx on public.profiles (default_workspace_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index workspace_invites_workspace_id_idx on public.workspace_invites (workspace_id);
create index workspace_invites_email_idx on public.workspace_invites (lower(email)) where accepted_at is null;

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  name text not null default 'Untitled list' check (char_length(name) between 1 and 120),
  status public.list_status not null default 'draft',
  mode public.list_mode not null default 'enrich',
  enrich_fields text[] not null default '{}',
  file_path text,
  file_type text check (file_type in ('csv', 'xlsx')),
  file_name text,
  column_mapping jsonb not null default '{}'::jsonb,
  has_header boolean not null default true,
  row_limit integer,
  total_rows integer not null default 0,
  enrichable_rows integer not null default 0,
  submitted_rows integer not null default 0,
  processed_rows integer not null default 0,
  found_work_email integer not null default 0,
  found_personal_email integer not null default 0,
  found_phone integer not null default 0,
  risky_email integer not null default 0,
  not_found integer not null default 0,
  duplicates_removed integer not null default 0,
  cached_rows integer not null default 0,
  credits_estimated integer not null default 0,
  credits_max integer not null default 0,
  credits_used integer not null default 0,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_workspace_id_created_at_idx on public.lists (workspace_id, created_at desc);
create index lists_status_idx on public.lists (status) where status in ('queued', 'enriching', 'stopping', 'paused_credits');
create trigger lists_updated_at before update on public.lists
  for each row execute function public.set_updated_at();

create table public.enrichment_batches (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.list_mode not null default 'enrich',
  provider text not null default 'fullenrich',
  provider_enrichment_id text unique,
  status public.batch_status not null default 'submitted',
  contact_count integer not null default 0,
  credits_cost integer,
  settled_at timestamptz,
  submitted_at timestamptz not null default now(),
  finished_at timestamptz,
  last_polled_at timestamptz,
  attempts integer not null default 0,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index enrichment_batches_list_id_idx on public.enrichment_batches (list_id);
create index enrichment_batches_workspace_id_idx on public.enrichment_batches (workspace_id);
create index enrichment_batches_open_idx on public.enrichment_batches (submitted_at) where status = 'submitted';
create index enrichment_batches_unsettled_idx on public.enrichment_batches (finished_at) where settled_at is null and status <> 'submitted';

create table public.list_contacts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  row_index integer not null,
  raw jsonb not null default '{}'::jsonb,
  first_name text,
  last_name text,
  full_name text,
  company_name text,
  domain text,
  linkedin_url text,
  email_input text,
  input_hash text,
  status public.contact_status not null default 'pending',
  skip_reason text,
  work_email text,
  work_email_status text,
  personal_email text,
  personal_email_status text,
  phone text,
  phone_meta jsonb,
  job_title text,
  company text,
  company_domain text,
  company_logo_url text,
  location text,
  profile jsonb,
  result jsonb,
  credits_cost integer not null default 0,
  batch_id uuid references public.enrichment_batches (id) on delete set null,
  enriched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (list_id, row_index)
);
create index list_contacts_list_id_status_idx on public.list_contacts (list_id, status);
create index list_contacts_workspace_input_hash_idx on public.list_contacts (workspace_id, input_hash);
create index list_contacts_batch_id_idx on public.list_contacts (batch_id);

create table public.enrichment_cache (
  input_hash text primary key,
  fields text[] not null default '{}',
  result jsonb not null,
  provider text not null default 'fullenrich',
  source_workspace_id uuid references public.workspaces (id) on delete set null,
  fetched_at timestamptz not null default now()
);
create index enrichment_cache_fetched_at_idx on public.enrichment_cache (fetched_at);

create table public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  amount integer not null check (amount > 0),
  remaining integer not null check (remaining >= 0),
  source public.grant_source not null,
  stripe_invoice_id text unique,
  note text,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index credit_grants_workspace_expires_idx on public.credit_grants (workspace_id, expires_at) where remaining > 0;

create table public.credit_holds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index credit_holds_workspace_open_idx on public.credit_holds (workspace_id) where released_at is null;
create index credit_holds_list_id_idx on public.credit_holds (list_id);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  grant_id uuid references public.credit_grants (id) on delete set null,
  list_id uuid references public.lists (id) on delete set null,
  batch_id uuid references public.enrichment_batches (id) on delete set null,
  kind public.ledger_kind not null,
  delta integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index credit_ledger_workspace_created_idx on public.credit_ledger (workspace_id, created_at desc);
create index credit_ledger_grant_id_idx on public.credit_ledger (grant_id);
create index credit_ledger_list_id_idx on public.credit_ledger (list_id);
create index credit_ledger_batch_id_idx on public.credit_ledger (batch_id);

create table public.provider_rate_limit (
  provider text primary key,
  window_start timestamptz not null default date_trunc('minute', now()),
  submit_count integer not null default 0,
  get_count integer not null default 0
);
insert into public.provider_rate_limit (provider) values ('fullenrich');

create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  external_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, external_id)
);
create index webhook_events_unprocessed_idx on public.webhook_events (received_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer, search_path cleared, uid checked inside)
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.is_workspace_admin(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_admin(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Credits
-- ---------------------------------------------------------------------------
create or replace function public.credits_available(ws uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select sum(g.remaining) from public.credit_grants g
    where g.workspace_id = ws and g.expires_at > now() and g.remaining > 0
  ), 0)::integer
  - coalesce((
    select sum(h.amount) from public.credit_holds h
    where h.workspace_id = ws and h.released_at is null
  ), 0)::integer;
$$;
revoke execute on function public.credits_available(uuid) from public, anon;
grant execute on function public.credits_available(uuid) to authenticated, service_role;

-- Drains earliest-expiring grants first. Returns the amount actually consumed
-- (may be less than requested when the workspace is overdrawn; the caller
-- records the shortfall as an `adjust` entry).
create or replace function public.consume_credits(ws uuid, amount integer, p_list_id uuid, p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  left_to_take integer := amount;
  take integer;
begin
  if amount <= 0 then
    return 0;
  end if;

  for g in
    select id, remaining from public.credit_grants
    where workspace_id = ws and expires_at > now() and remaining > 0
    order by expires_at asc, granted_at asc
    for update
  loop
    exit when left_to_take <= 0;
    take := least(g.remaining, left_to_take);
    update public.credit_grants set remaining = remaining - take where id = g.id;
    insert into public.credit_ledger (workspace_id, grant_id, list_id, batch_id, kind, delta)
      values (ws, g.id, p_list_id, p_batch_id, 'consume', -take);
    left_to_take := left_to_take - take;
  end loop;

  return amount - left_to_take;
end;
$$;
revoke execute on function public.consume_credits(uuid, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_credits(uuid, integer, uuid, uuid) to service_role;

create or replace function public.expire_grants()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  expired integer := 0;
begin
  for g in
    select id, workspace_id, remaining from public.credit_grants
    where expires_at <= now() and remaining > 0
    for update skip locked
  loop
    insert into public.credit_ledger (workspace_id, grant_id, kind, delta, note)
      values (g.workspace_id, g.id, 'expire', -g.remaining, 'Credits expired');
    update public.credit_grants set remaining = 0 where id = g.id;
    expired := expired + 1;
  end loop;
  return expired;
end;
$$;
revoke execute on function public.expire_grants() from public, anon, authenticated;
grant execute on function public.expire_grants() to service_role;

-- Grant helper used by the trial trigger and Stripe webhook (idempotent on invoice).
create or replace function public.grant_credits(
  ws uuid, amount integer, p_source public.grant_source, p_expires_at timestamptz,
  p_stripe_invoice_id text default null, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if p_stripe_invoice_id is not null then
    select id into gid from public.credit_grants where stripe_invoice_id = p_stripe_invoice_id;
    if gid is not null then
      return gid;
    end if;
  end if;
  insert into public.credit_grants (workspace_id, amount, remaining, source, stripe_invoice_id, note, expires_at)
    values (ws, amount, amount, p_source, p_stripe_invoice_id, p_note, p_expires_at)
    returning id into gid;
  insert into public.credit_ledger (workspace_id, grant_id, kind, delta, note)
    values (ws, gid, 'grant', amount, coalesce(p_note, p_source::text));
  return gid;
end;
$$;
revoke execute on function public.grant_credits(uuid, integer, public.grant_source, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer, public.grant_source, timestamptz, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Signup trigger: profile → pending invite ? membership : workspace + trial
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    nullif(split_part(v_email, '@', 1), '')
  );
  v_avatar text := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
  v_provider_id text := new.raw_user_meta_data ->> 'provider_id';
  v_domain text := split_part(v_email, '@', 2);
  v_invite record;
  v_ws uuid;
  v_ws_name text;
  v_slug text;
  v_trial_ok boolean := true;
  v_public_domains text[] := array['gmail.com','googlemail.com','yahoo.com','hotmail.com','outlook.com','live.com','icloud.com','me.com','aol.com','proton.me','protonmail.com'];
begin
  insert into public.profiles (id, email, full_name, avatar_url)
    values (new.id, v_email, v_name, v_avatar)
    on conflict (id) do nothing;

  -- Pending invite: join that workspace, no workspace of their own, no trial.
  select * into v_invite from public.workspace_invites
    where lower(email) = v_email and accepted_at is null and expires_at > now()
    order by created_at desc limit 1;

  if v_invite.id is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
      values (v_invite.workspace_id, new.id, v_invite.role)
      on conflict do nothing;
    update public.workspace_invites set accepted_at = now() where id = v_invite.id;
    update public.profiles set default_workspace_id = v_invite.workspace_id where id = new.id;
    return new;
  end if;

  -- Own workspace.
  v_ws_name := case
    when v_domain = '' or v_domain = any(v_public_domains) then coalesce(v_name, 'My') || '''s workspace'
    else initcap(split_part(v_domain, '.', 1))
  end;
  v_slug := regexp_replace(lower(v_ws_name), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.workspaces (name, slug, owner_id)
    values (v_ws_name, v_slug, new.id)
    returning id into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, new.id, 'owner');
  update public.profiles set default_workspace_id = v_ws where id = new.id;

  -- Trial abuse guard: same Google identity already used, or >= 3 trials from
  -- this (non-public) email domain in 30 days.
  if v_provider_id is not null and exists (
    select 1 from auth.identities i where i.provider_id = v_provider_id and i.user_id <> new.id
  ) then
    v_trial_ok := false;
  end if;
  if v_trial_ok and v_domain <> '' and not (v_domain = any(v_public_domains)) and (
    select count(*) from public.workspaces w
    join public.profiles p on p.id = w.owner_id
    where w.trial_granted_at > now() - interval '30 days'
      and split_part(p.email, '@', 2) = v_domain
  ) >= 3 then
    v_trial_ok := false;
  end if;

  if v_trial_ok then
    perform public.grant_credits(v_ws, 25, 'trial', now() + interval '30 days', null, 'Welcome trial');
    update public.workspaces set trial_granted_at = now() where id = v_ws;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- List counters: recompute from list_contacts (idempotent, statement-level)
-- ---------------------------------------------------------------------------
create or replace function public.recompute_list_counters(p_list_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.lists l set
    total_rows = s.total_rows,
    enrichable_rows = s.enrichable_rows,
    submitted_rows = s.submitted_rows,
    processed_rows = s.processed_rows,
    found_work_email = s.found_work_email,
    found_personal_email = s.found_personal_email,
    found_phone = s.found_phone,
    risky_email = s.risky_email,
    not_found = s.not_found,
    cached_rows = s.cached_rows,
    credits_used = s.credits_used
  from (
    select
      count(*)::int as total_rows,
      count(*) filter (where status <> 'skipped')::int as enrichable_rows,
      count(*) filter (where status in ('submitted', 'enriched', 'not_found', 'failed', 'cached'))::int as submitted_rows,
      count(*) filter (where status in ('enriched', 'not_found', 'failed', 'cached'))::int as processed_rows,
      count(*) filter (where work_email is not null and work_email_status in ('DELIVERABLE', 'HIGH_PROBABILITY'))::int as found_work_email,
      count(*) filter (where personal_email is not null)::int as found_personal_email,
      count(*) filter (where phone is not null and phone_meta ->> 'line_type' = 'MOBILE')::int as found_phone,
      count(*) filter (where work_email is not null and work_email_status = 'CATCH_ALL')::int as risky_email,
      count(*) filter (where status = 'not_found')::int as not_found,
      count(*) filter (where status = 'cached')::int as cached_rows,
      coalesce(sum(credits_cost), 0)::int as credits_used
    from public.list_contacts c where c.list_id = p_list_id
  ) s
  where l.id = p_list_id;
$$;
revoke execute on function public.recompute_list_counters(uuid) from public, anon, authenticated;
grant execute on function public.recompute_list_counters(uuid) to service_role;

create or replace function public.list_contacts_counters_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lid uuid;
begin
  if tg_op = 'INSERT' then
    for lid in select distinct list_id from new_rows loop
      perform public.recompute_list_counters(lid);
    end loop;
  elsif tg_op = 'DELETE' then
    for lid in select distinct list_id from old_rows loop
      perform public.recompute_list_counters(lid);
    end loop;
  else
    for lid in
      select distinct list_id from (
        select list_id from new_rows union select list_id from old_rows
      ) t
    loop
      perform public.recompute_list_counters(lid);
    end loop;
  end if;
  return null;
end;
$$;

create trigger list_contacts_counters_ins
  after insert on public.list_contacts
  referencing new table as new_rows
  for each statement execute function public.list_contacts_counters_trigger();
create trigger list_contacts_counters_upd
  after update on public.list_contacts
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.list_contacts_counters_trigger();
create trigger list_contacts_counters_del
  after delete on public.list_contacts
  referencing old table as old_rows
  for each statement execute function public.list_contacts_counters_trigger();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.lists enable row level security;
alter table public.list_contacts enable row level security;
alter table public.enrichment_batches enable row level security;
alter table public.enrichment_cache enable row level security;
alter table public.credit_grants enable row level security;
alter table public.credit_holds enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.provider_rate_limit enable row level security;
alter table public.webhook_events enable row level security;

-- profiles: own row, plus co-members of any shared workspace (member lists).
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members me
      join public.workspace_members them on them.workspace_id = me.workspace_id
      where me.user_id = (select auth.uid()) and them.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces
create policy workspaces_select on public.workspaces for select to authenticated
  using ((select public.is_workspace_member(id)));
create policy workspaces_update on public.workspaces for update to authenticated
  using ((select public.is_workspace_admin(id))) with check ((select public.is_workspace_admin(id)));

-- workspace_members
create policy workspace_members_select on public.workspace_members for select to authenticated
  using ((select public.is_workspace_member(workspace_id)));
create policy workspace_members_update on public.workspace_members for update to authenticated
  using ((select public.is_workspace_admin(workspace_id)) and role <> 'owner')
  with check ((select public.is_workspace_admin(workspace_id)) and role <> 'owner');
create policy workspace_members_delete on public.workspace_members for delete to authenticated
  using (
    role <> 'owner'
    and ((select public.is_workspace_admin(workspace_id)) or user_id = (select auth.uid()))
  );

-- workspace_invites (admins manage; acceptance runs through the service role)
create policy workspace_invites_select on public.workspace_invites for select to authenticated
  using ((select public.is_workspace_admin(workspace_id)));
create policy workspace_invites_insert on public.workspace_invites for insert to authenticated
  with check ((select public.is_workspace_admin(workspace_id)) and invited_by = (select auth.uid()));
create policy workspace_invites_delete on public.workspace_invites for delete to authenticated
  using ((select public.is_workspace_admin(workspace_id)));

-- lists
create policy lists_select on public.lists for select to authenticated
  using ((select public.is_workspace_member(workspace_id)));
create policy lists_insert on public.lists for insert to authenticated
  with check ((select public.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy lists_update on public.lists for update to authenticated
  using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));
create policy lists_delete on public.lists for delete to authenticated
  using ((select public.is_workspace_admin(workspace_id)) or created_by = (select auth.uid()));

-- list_contacts / batches: members read; writes via service role only.
create policy list_contacts_select on public.list_contacts for select to authenticated
  using ((select public.is_workspace_member(workspace_id)));
create policy enrichment_batches_select on public.enrichment_batches for select to authenticated
  using ((select public.is_workspace_member(workspace_id)));

-- credits: members read; writes via service role functions only.
create policy credit_grants_select on public.credit_grants for select to authenticated
  using ((select public.is_workspace_member(workspace_id)));
create policy credit_holds_select on public.credit_holds for select to authenticated
  using ((select public.is_workspace_member(workspace_id)));
create policy credit_ledger_select on public.credit_ledger for select to authenticated
  using ((select public.is_workspace_member(workspace_id)));

-- enrichment_cache, provider_rate_limit, webhook_events: no policies → service role only.

-- ---------------------------------------------------------------------------
-- Storage: private bucket, path ${workspace_id}/${list_id}/original.<ext>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'list-uploads', 'list-uploads', false, 20971520,
  array['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream']
)
on conflict (id) do nothing;

create policy list_uploads_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'list-uploads'
    and (select public.is_workspace_member(((storage.foldername(name))[1])::uuid))
  );
create policy list_uploads_select on storage.objects for select to authenticated
  using (
    bucket_id = 'list-uploads'
    and (select public.is_workspace_member(((storage.foldername(name))[1])::uuid))
  );
create policy list_uploads_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'list-uploads'
    and (select public.is_workspace_admin(((storage.foldername(name))[1])::uuid))
  );

-- ---------------------------------------------------------------------------
-- Realtime: only the lists row stream.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.lists;
