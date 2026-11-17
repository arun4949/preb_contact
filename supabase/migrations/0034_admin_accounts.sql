-- 0034: admin accounts. Read-only helpers for /admin/ops, /admin/users and
-- /admin/users/[id]. Additive only: two functions, no table or column change
-- (dev and production share this database).
--
-- "Credits spent" has one definition, and it lives here. Credits belong to the
-- workspace and the ledger is the only record that survives a deleted list
-- (`list_contacts` and `credit_overages` cascade, `credit_ledger.list_id` and
-- `batch_id` are set to null), so spend is read from `credit_ledger`:
--   consume  paid from the balance (internal workspace: measured, not charged)
--   overage  overspend, invoiced in money at the plan rate
--   adjust   negative and without a grant: "Overdraft absorbed" by Preb
-- Not spend: grant, expire, zero-delta reconciliation notes and "Referral
-- reward revoked" (an adjust that carries its grant_id). The absorbed overdraft
-- is told apart by the missing grant, not by batch_id, because the batch link
-- is gone once the list is deleted. See `settle_batch` in 0027.
--
-- Both functions are service role only: the admin pages check the allowlist
-- (`ADMIN_EMAILS`) and then read with the service-role client.

create function public.admin_workspace_spend(p_workspaces uuid[])
returns table (
  workspace_id uuid,
  spent integer,
  from_balance integer,
  overspend integer,
  absorbed integer,
  spent_30d integer,
  last_spend_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.workspace_id,
    coalesce(-sum(l.delta), 0)::integer,
    coalesce(-sum(l.delta) filter (where l.kind = 'consume'), 0)::integer,
    coalesce(-sum(l.delta) filter (where l.kind = 'overage'), 0)::integer,
    coalesce(-sum(l.delta) filter (where l.kind = 'adjust'), 0)::integer,
    coalesce(-sum(l.delta) filter (where l.created_at >= now() - interval '30 days'), 0)::integer,
    max(l.created_at)
  from public.credit_ledger l
  where l.workspace_id = any (p_workspaces)
    and l.delta < 0
    and (l.kind in ('consume', 'overage') or (l.kind = 'adjust' and l.grant_id is null))
  group by l.workspace_id;
$$;
comment on function public.admin_workspace_spend(uuid[]) is
  'Admin only. Credits spent per workspace from the ledger: total, from balance, overspend, absorbed overdraft, last 30 days. Workspaces without spend return no row.';
revoke execute on function public.admin_workspace_spend(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_workspace_spend(uuid[]) to service_role;

-- Every account with its default workspace, for the accounts page. Search,
-- filter, sort and paging happen here so the page never loads all rows.
-- Unknown filter or sort values fall back to "all" and "created".
create function public.admin_accounts(
  p_search text default null,
  p_filter text default 'all',
  p_sort text default 'created',
  p_dir text default 'desc',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  onboarded_at timestamptz,
  last_sign_in_at timestamptz,
  workspace_id uuid,
  workspace_name text,
  workspace_kind text,
  plan_key text,
  subscription_status text,
  trial_granted_at timestamptz,
  member_role text,
  credits_spent integer,
  credits_available integer,
  lists_count integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with pattern as (
    select case
      when nullif(btrim(coalesce(p_search, '')), '') is null then null
      else '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as pat
  ),
  spend as (
    select s.workspace_id, s.spent
    from public.admin_workspace_spend(
      (select coalesce(array_agg(distinct p.default_workspace_id), '{}') from public.profiles p where p.default_workspace_id is not null)
    ) s
  ),
  list_counts as (
    select l.workspace_id, count(*)::integer as n
    from public.lists l
    where l.status <> 'draft'
    group by l.workspace_id
  ),
  base as (
    select
      p.id as user_id,
      p.email,
      p.full_name,
      p.created_at,
      p.onboarded_at,
      u.last_sign_in_at,
      w.id as workspace_id,
      w.name as workspace_name,
      w.kind as workspace_kind,
      w.plan_key,
      w.subscription_status,
      w.trial_granted_at,
      m.role::text as member_role,
      coalesce(s.spent, 0) as credits_spent,
      case when w.id is null then 0 else public.credits_available(w.id) end as credits_available,
      coalesce(lc.n, 0) as lists_count
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.workspaces w on w.id = p.default_workspace_id
    left join public.workspace_members m on m.workspace_id = w.id and m.user_id = p.id
    left join spend s on s.workspace_id = w.id
    left join list_counts lc on lc.workspace_id = w.id
    cross join pattern
    where (
      pattern.pat is null
      or p.email ilike pattern.pat
      or p.full_name ilike pattern.pat
      or w.name ilike pattern.pat
    )
  ),
  filtered as (
    select b.* from base b
    where case p_filter
      when 'onboarded' then b.onboarded_at is not null
      when 'paying' then b.plan_key is not null
      when 'trial' then b.plan_key is null and b.trial_granted_at is not null
      when 'spend' then b.credits_spent > 0
      else true
    end
  ),
  keyed as (
    select f.*,
      case p_sort
        when 'last_sign_in' then extract(epoch from f.last_sign_in_at)
        when 'spent' then f.credits_spent::numeric
        when 'available' then f.credits_available::numeric
        when 'lists' then f.lists_count::numeric
        else extract(epoch from f.created_at)
      end as sort_key
    from filtered f
  )
  select
    k.user_id, k.email, k.full_name, k.created_at, k.onboarded_at, k.last_sign_in_at,
    k.workspace_id, k.workspace_name, k.workspace_kind, k.plan_key, k.subscription_status, k.trial_granted_at,
    k.member_role, k.credits_spent, k.credits_available, k.lists_count,
    count(*) over () as total_count
  from keyed k
  order by
    case when p_dir = 'asc' then k.sort_key end asc nulls last,
    case when p_dir = 'asc' then null else k.sort_key end desc nulls last,
    k.created_at desc,
    k.user_id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
comment on function public.admin_accounts(text, text, text, text, integer, integer) is
  'Admin only. One row per account with its default workspace, credits spent (admin_workspace_spend), credits available and list count; searched, filtered, sorted and paged.';
revoke execute on function public.admin_accounts(text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_accounts(text, text, text, text, integer, integer) to service_role;
