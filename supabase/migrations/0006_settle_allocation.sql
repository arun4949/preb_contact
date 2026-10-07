-- Day 3 E2E finding: the provider charged 0 credits (upstream 3-month dedup)
-- while the per-contact derivation said 14, so `lists.credits_used` (sum of
-- contact costs) showed 14 although nothing was consumed. settle_batch now
-- re-allocates the authoritative charge onto the batch's contacts so that
-- Σ list_contacts.credits_cost = what the ledger consumed for the batch.

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
begin
  select * into b from public.enrichment_batches
    where id = p_batch_id and settled_at is null and status <> 'submitted'
    for update skip locked;
  if not found then
    return;
  end if;

  select coalesce(sum(lc.credits_cost), 0)::int into v_derived
    from public.list_contacts lc where lc.batch_id = p_batch_id;
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
    -- Allocate the real charge in row order, capped by each contact's derived
    -- cost; any excess lands on the last charged contact.
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
        select id into v_last from public.list_contacts where batch_id = p_batch_id order by row_index desc limit 1;
      end if;
      update public.list_contacts set credits_cost = credits_cost + v_left where id = v_last;
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

-- Correct the one already-settled E2E batch (provider charged 0).
update public.list_contacts c set credits_cost = 0
from public.enrichment_batches b
where c.batch_id = b.id and b.settled_at is not null and b.credits_cost = 0 and c.credits_cost <> 0;
