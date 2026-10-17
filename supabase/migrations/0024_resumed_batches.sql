-- 0024: resumed batches. When FullEnrich runs out of credits mid-batch it
-- reports CREDITS_INSUFFICIENT and, once the account is topped up, resumes the
-- same enrichment and reports FINISHED with the full cost. The first report was
-- already settled, so a second settlement must charge only the difference.
-- `settled_credits` remembers what a batch has been charged so far;
-- settle_batch charges `credits_cost - settled_credits` and the caller re-opens
-- the batch by clearing `settled_at`.

alter table public.enrichment_batches
  add column settled_credits integer not null default 0;
comment on column public.enrichment_batches.settled_credits is
  'Preb credits already charged for this batch. A resumed batch (CREDITS_INSUFFICIENT then FINISHED) is settled twice; the second run charges only the difference.';

update public.enrichment_batches
  set settled_credits = coalesce(credits_cost, 0)
  where settled_at is not null;

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
  v_delta integer;
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
  -- A resumed batch was already charged `settled_credits`; only the rest is new.
  v_delta := greatest(0, v_charged - coalesce(b.settled_credits, 0));

  if v_kind = 'internal' then
    -- Measured, not charged: no grant is touched, one ledger row records the spend.
    v_taken := v_delta;
    if v_delta > 0 then
      insert into public.credit_ledger (workspace_id, list_id, batch_id, kind, delta, note)
        values (b.workspace_id, b.list_id, p_batch_id, 'consume', -v_delta, 'Internal workspace, not charged');
    end if;
  else
    v_taken := public.consume_credits(b.workspace_id, v_delta, b.list_id, p_batch_id);
    v_short := v_delta - v_taken;
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
    set amount = greatest(0, amount - v_delta)
    where list_id = b.list_id and released_at is null;

  update public.enrichment_batches
    set settled_at = now(), credits_cost = v_charged, settled_credits = v_charged
    where id = p_batch_id;

  return query select v_delta, v_taken, v_derived;
end;
$$;
revoke execute on function public.settle_batch(uuid) from public, anon, authenticated;
grant execute on function public.settle_batch(uuid) to service_role;
