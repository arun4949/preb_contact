-- 0027: overspend. An owner or admin can opt the workspace in to keep
-- enriching when the balance is empty; every settled shortfall becomes a
-- `credit_overages` row that is invoiced per list (when it finishes) at the
-- plan's per-credit rate and charged to the subscription's payment method.
-- The balance never goes negative. Internal workspaces are never charged.

-- Workspace setting -----------------------------------------------------------
alter table public.workspaces
  add column overspend_enabled boolean not null default false,
  add column overspend_monthly_limit integer check (overspend_monthly_limit is null or overspend_monthly_limit > 0),
  add column overspend_enabled_at timestamptz,
  add column overspend_enabled_by uuid references public.profiles(id) on delete set null,
  add column overspend_blocked_reason text check (overspend_blocked_reason is null or overspend_blocked_reason in ('payment_failed')),
  add column overspend_blocked_at timestamptz;
comment on column public.workspaces.overspend_enabled is 'Opt-in: lists keep enriching when the balance is empty; the shortfall is invoiced at the plan rate.';
comment on column public.workspaces.overspend_monthly_limit is 'Max overspend credits per calendar month (UTC); null = no limit.';
comment on column public.workspaces.overspend_enabled_by is 'Who confirmed the overspend terms (owner or admin).';
comment on column public.workspaces.overspend_blocked_reason is 'Set when an overspend invoice could not be paid; lists that need extra credits pause until it is paid.';

-- Per-list permission and pause reason ---------------------------------------
alter table public.lists
  add column overspend_allowed boolean not null default false,
  add column pause_reason text check (pause_reason is null or pause_reason in ('credits', 'overspend_limit', 'overspend_payment'));
comment on column public.lists.overspend_allowed is 'The list may spend beyond the balance (workspace opt-in and the per-list switch at start).';
comment on column public.lists.pause_reason is 'Why the list is paused_credits: no credits, monthly overspend limit reached, or an overspend payment failed.';

-- Overspend records ----------------------------------------------------------
create table public.credit_overages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  batch_id uuid references public.enrichment_batches(id) on delete set null,
  credits integer not null check (credits > 0),
  plan_key text,
  status text not null default 'pending' check (status in ('pending', 'invoicing', 'paid', 'failed', 'action_required')),
  stripe_invoice_id text,
  amount_cents integer,
  error text,
  created_at timestamptz not null default now(),
  invoiced_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz
);
comment on table public.credit_overages is 'Credits spent beyond the balance under the overspend opt-in. One row per settled batch shortfall; invoiced per workspace when a list finishes.';
comment on column public.credit_overages.credits is 'Preb credits beyond the balance in this batch.';
comment on column public.credit_overages.plan_key is 'Plan at settlement time; its per-credit rate prices the row.';
comment on column public.credit_overages.status is 'pending → invoicing → paid | failed | action_required (3-D Secure). failed/action_required rows are paid later by the webhook or a retry.';
comment on column public.credit_overages.amount_cents is 'Share of the invoice total for this row, USD cents (set when invoiced).';
create index credit_overages_workspace_status_idx on public.credit_overages (workspace_id, status);
create index credit_overages_invoice_idx on public.credit_overages (stripe_invoice_id) where stripe_invoice_id is not null;
create index credit_overages_list_idx on public.credit_overages (list_id);
create index credit_overages_batch_idx on public.credit_overages (batch_id) where batch_id is not null;
alter table public.credit_overages enable row level security;
create policy credit_overages_select on public.credit_overages for select to authenticated
  using (public.is_workspace_member(workspace_id));
revoke insert, update, delete on public.credit_overages from authenticated, anon;

-- Notification kinds ---------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'admin',
  'member_joined', 'member_welcome', 'member_left', 'member_removed', 'role_changed', 'workspace_deleted',
  'list_finished', 'list_stopped', 'list_paused_credits', 'list_paused_upstream', 'list_failed',
  'credits_low', 'credits_granted', 'credits_expiring', 'trial_ending',
  'plan_started', 'plan_changed', 'plan_cancel_scheduled', 'plan_cancel_reverted', 'plan_canceled',
  'overspend_charged', 'overspend_failed'
));

-- Overspend used this calendar month (UTC), any status: failed invoices are
-- still spend and count against the limit. Service-role calls are unrestricted;
-- authenticated callers must be members (same pattern as credits_available).
create or replace function public.overspend_used_this_month(ws uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null and not public.is_workspace_member(ws) then 0
    else coalesce((
      select sum(o.credits) from public.credit_overages o
      where o.workspace_id = ws
        and o.created_at >= date_trunc('month', (now() at time zone 'utc'))::timestamptz
    ), 0)::int
  end;
$$;
revoke execute on function public.overspend_used_this_month(uuid) from public, anon;
grant execute on function public.overspend_used_this_month(uuid) to authenticated, service_role;

-- settle_batch: identical to 0024 except that a shortfall of a list with
-- `overspend_allowed` becomes an overage row + 'overage' ledger row instead
-- of the absorbed overdraft. The return type gains `overage`.
drop function public.settle_batch(uuid);
create function public.settle_batch(p_batch_id uuid)
returns table (charged integer, consumed integer, derived integer, overage integer)
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
  v_overage integer := 0;
  v_left integer;
  v_last uuid;
  v_kind text;
  v_plan text;
  v_overspend boolean;
begin
  select * into b from public.enrichment_batches
    where id = p_batch_id and settled_at is null and status <> 'submitted'
    for update skip locked;
  if not found then
    return;
  end if;

  select w.kind, w.plan_key into v_kind, v_plan from public.workspaces w where w.id = b.workspace_id;
  select l.overspend_allowed into v_overspend from public.lists l where l.id = b.list_id;

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
    if v_short > 0 and coalesce(v_overspend, false) then
      -- Overspend opt-in: the shortfall is invoiced in money at the plan rate.
      v_overage := v_short;
      insert into public.credit_overages (workspace_id, list_id, batch_id, credits, plan_key)
        values (b.workspace_id, b.list_id, p_batch_id, v_short, v_plan);
      insert into public.credit_ledger (workspace_id, list_id, batch_id, kind, delta, note)
        values (b.workspace_id, b.list_id, p_batch_id, 'overage', -v_short, 'Overspend, charged to your payment method');
    elsif v_short > 0 then
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

  return query select v_delta, v_taken, v_derived, v_overage;
end;
$$;
revoke execute on function public.settle_batch(uuid) from public, anon, authenticated;
grant execute on function public.settle_batch(uuid) to service_role;
