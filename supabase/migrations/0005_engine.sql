-- Enrichment engine (day 3): atomic primitives the dispatcher, webhook and
-- settler rely on so that concurrent ticks (cron + after()) and webhook
-- retries can never double-submit a contact or double-charge a batch.
-- All functions are service-role only.

-- ---------------------------------------------------------------------------
-- Rate limit: the provider allows 60 calls per fixed calendar minute across
-- all endpoints. We budget 40 submits + 10 GETs per minute and claim one slot
-- per call. Returns true when the call may go out.
create or replace function public.claim_rate_slot(p_provider text, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  win timestamptz := date_trunc('minute', now());
  submit_cap constant integer := 40;
  get_cap constant integer := 10;
begin
  insert into public.provider_rate_limit (provider) values (p_provider) on conflict (provider) do nothing;
  select * into r from public.provider_rate_limit where provider = p_provider for update;
  if r.window_start <> win then
    update public.provider_rate_limit
      set window_start = win, submit_count = 0, get_count = 0
      where provider = p_provider;
    r.submit_count := 0;
    r.get_count := 0;
  end if;
  if p_kind = 'submit' then
    if r.submit_count >= submit_cap then return false; end if;
    update public.provider_rate_limit set submit_count = submit_count + 1 where provider = p_provider;
    return true;
  elsif p_kind = 'get' then
    if r.get_count >= get_cap then return false; end if;
    update public.provider_rate_limit set get_count = get_count + 1 where provider = p_provider;
    return true;
  end if;
  return false;
end;
$$;
revoke execute on function public.claim_rate_slot(text, text) from public, anon, authenticated;
grant execute on function public.claim_rate_slot(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Claim up to p_limit pending contacts of a list for a batch. Row locks with
-- SKIP LOCKED make two concurrent dispatchers pick disjoint rows. The caller
-- reverts the rows to `pending` if the provider rejects the batch.
create or replace function public.claim_pending_contacts(p_list_id uuid, p_batch_id uuid, p_limit integer)
returns setof public.list_contacts
language sql
security definer
set search_path = ''
as $$
  update public.list_contacts c
    set status = 'submitted', batch_id = p_batch_id
  where c.id in (
    select id from public.list_contacts
    where list_id = p_list_id and status = 'pending'
    order by row_index
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning c.*;
$$;
revoke execute on function public.claim_pending_contacts(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_pending_contacts(uuid, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Settle one terminal batch exactly once: charge the authoritative provider
-- cost (fallback: sum of per-contact derived costs), log an overdraft or a
-- reconciliation delta as `adjust`, and shrink the list's open hold by what
-- was charged so `credits_available` does not count the same credits twice.
create or replace function public.settle_batch(p_batch_id uuid)
returns table (charged integer, consumed integer, derived integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  v_derived integer;
  v_charged integer;
  v_taken integer;
  v_short integer;
begin
  select * into b from public.enrichment_batches
    where id = p_batch_id and settled_at is null and status <> 'submitted'
    for update skip locked;
  if not found then
    return;
  end if;

  select coalesce(sum(c.credits_cost), 0)::int into v_derived
    from public.list_contacts c where c.batch_id = p_batch_id;
  v_charged := coalesce(b.credits_cost, v_derived);

  v_taken := public.consume_credits(b.workspace_id, v_charged, b.list_id, p_batch_id);
  v_short := v_charged - v_taken;
  if v_short > 0 then
    insert into public.credit_ledger (workspace_id, list_id, batch_id, kind, delta, note)
      values (b.workspace_id, b.list_id, p_batch_id, 'adjust', -v_short, 'Overdraft absorbed');
  end if;
  if v_charged <> v_derived then
    insert into public.credit_ledger (workspace_id, list_id, batch_id, kind, delta, note)
      values (b.workspace_id, b.list_id, p_batch_id, 'adjust', 0,
              format('Provider charged %s credits, per-contact derivation says %s', v_charged, v_derived));
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

-- ---------------------------------------------------------------------------
-- Dispatcher lookups
create index if not exists list_contacts_list_batch_idx on public.list_contacts (list_id, batch_id) where batch_id is not null;
create index if not exists enrichment_batches_list_status_idx on public.enrichment_batches (list_id, status, created_at desc);
create index if not exists lists_engine_idx on public.lists (status, updated_at)
  where status in ('queued', 'enriching', 'stopping', 'paused_credits', 'paused_upstream');
