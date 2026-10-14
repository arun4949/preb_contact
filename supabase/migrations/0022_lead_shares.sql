-- 0022: lead magnet funnel. Preb admins enrich a handful of profiles for a
-- prospect in one internal "Preb outreach" workspace and share the finished
-- list through a public link protected by a 4-digit code. Internal workspaces
-- are never charged credits: spend is measured (list_contacts.credits_cost,
-- lists.credits_used, one credit_ledger row per settled batch) but no grant is
-- consumed. Both new tables are service-role only (RLS on, no policies).

alter table public.workspaces
  add column kind text not null default 'customer' check (kind in ('customer', 'internal'));
comment on column public.workspaces.kind is
  'customer (default) or internal: the Preb outreach workspace for sample enrichments, never charged credits.';
create index workspaces_kind_internal_idx on public.workspaces (kind) where kind = 'internal';

create table public.lead_shares (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null unique references public.lists (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  lead_name text not null check (char_length(lead_name) between 1 and 120),
  lead_linkedin_url text not null check (char_length(lead_linkedin_url) between 1 and 300),
  lead_email text check (lead_email is null or char_length(lead_email) <= 254),
  lead_company text check (lead_company is null or char_length(lead_company) <= 120),
  token_hash text not null unique,
  code text not null check (code ~ '^[0-9]{4}$'),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  revoked_at timestamptz,
  first_opened_at timestamptz,
  unlocked_at timestamptz,
  last_seen_at timestamptz,
  download_count integer not null default 0 check (download_count >= 0),
  popup_shown_at timestamptz,
  signed_up_user_id uuid references public.profiles (id) on delete set null,
  signed_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.lead_shares is
  'Public, code-protected share of a sample enrichment for a prospect (lead magnet). Service role only; managed on /admin/leads.';
create index lead_shares_owner_id_idx on public.lead_shares (owner_id);
create index lead_shares_created_at_idx on public.lead_shares (created_at desc);
create index lead_shares_signed_up_user_id_idx on public.lead_shares (signed_up_user_id) where signed_up_user_id is not null;
create trigger lead_shares_updated_at before update on public.lead_shares
  for each row execute function public.set_updated_at();
alter table public.lead_shares enable row level security;

create table public.lead_share_events (
  id bigint generated always as identity primary key,
  share_id uuid not null references public.lead_shares (id) on delete cascade,
  kind text not null check (kind in (
    'opened', 'code_failed', 'locked', 'unlocked', 'viewed', 'downloaded', 'popup_shown',
    'cta_signin', 'cta_signup', 'cta_offer', 'signed_up', 'revoked', 'restored', 'code_regenerated'
  )),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.lead_share_events is
  'Engagement events of a lead share. No IP address, no user agent. Service role only.';
create index lead_share_events_share_created_idx on public.lead_share_events (share_id, created_at desc);
alter table public.lead_share_events enable row level security;

-- settle_batch: same as 0021, plus the internal-workspace branch. An internal
-- batch is measured (one ledger row) but never consumes a grant and never
-- records an overdraft.
create or replace function public.settle_batch(p_batch_id uuid)
returns table (charged integer, consumed integer, derived integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  c record;
  v_derived integer;
  v_charged integer;
  v_taken integer;
  v_short integer;
  v_left integer;
  v_last uuid;
  v_kind text;
begin
  select * into b from public.enrichment_batches
    where id = p_batch_id and settled_at is null and status <> 'submitted'
    for update skip locked;
  if not found then
    return;
  end if;

  select w.kind into v_kind from public.workspaces w where w.id = b.workspace_id;

  select coalesce(sum(lc.credits_cost), 0)::int into v_derived
    from public.list_contacts lc where lc.batch_id = p_batch_id;
  v_charged := coalesce(b.credits_cost, v_derived);

  if v_kind = 'internal' then
    -- Measured, not charged: no grant is touched, one ledger row records the spend.
    v_taken := v_charged;
    if v_charged > 0 then
      insert into public.credit_ledger (workspace_id, list_id, batch_id, kind, delta, note)
        values (b.workspace_id, b.list_id, p_batch_id, 'consume', -v_charged, 'Internal workspace, not charged');
    end if;
  else
    v_taken := public.consume_credits(b.workspace_id, v_charged, b.list_id, p_batch_id);
    v_short := v_charged - v_taken;
    if v_short > 0 then
      insert into public.credit_ledger (workspace_id, list_id, batch_id, kind, delta, note)
        values (b.workspace_id, b.list_id, p_batch_id, 'adjust', -v_short, 'Overdraft absorbed');
    end if;
  end if;

  if v_charged <> v_derived then
    insert into public.credit_ledger (workspace_id, list_id, batch_id, kind, delta, note)
      values (b.workspace_id, b.list_id, p_batch_id, 'adjust', 0,
              format('Provider charged %s credits, per-contact derivation says %s', v_charged, v_derived));
    -- Allocate the real charge in row order, capped by each contact's derived
    -- cost; any excess lands on the last charged contact (never a suppressed one).
    v_left := v_charged;
    for c in
      select id, credits_cost from public.list_contacts
      where batch_id = p_batch_id
      order by row_index
      for update
    loop
      update public.list_contacts set credits_cost = least(c.credits_cost, v_left) where id = c.id;
      if c.credits_cost > 0 then v_last := c.id; end if;
      v_left := v_left - least(c.credits_cost, v_left);
    end loop;
    if v_left > 0 then
      if v_last is null then
        select id into v_last from public.list_contacts
          where batch_id = p_batch_id and skip_reason is distinct from 'suppressed'
          order by row_index desc limit 1;
      end if;
      if v_last is not null then
        update public.list_contacts set credits_cost = credits_cost + v_left where id = v_last;
      end if;
    end if;
  end if;

  update public.credit_holds
    set amount = greatest(0, amount - v_charged)
    where list_id = b.list_id and released_at is null;

  update public.enrichment_batches
    set settled_at = now(), credits_cost = v_charged
    where id = p_batch_id;

  return query select v_charged, v_taken, v_derived;
end;
$$;
revoke execute on function public.settle_batch(uuid) from public, anon, authenticated;
grant execute on function public.settle_batch(uuid) to service_role;
