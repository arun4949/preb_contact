-- 0032: reward_referral (0031) failed with "column reference referrer_workspace_id
-- is ambiguous": the function's output columns shadow the table columns inside
-- the body. Same logic, every table reference qualified.
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
  select rf.* into r from public.referrals rf
    where rf.referred_workspace_id = p_referred_workspace_id and rf.status in ('pending', 'rewarded')
    order by rf.created_at
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
    update public.referrals rf set status = 'expired' where rf.id = r.id;
    return query select 'expired'::text, r.id, r.referrer_workspace_id, null::uuid;
    return;
  end if;
  select w.kind into v_kind from public.workspaces w where w.id = r.referrer_workspace_id;
  if v_kind is null or v_kind = 'internal' or r.referrer_workspace_id = p_referred_workspace_id then
    update public.referrals rf set status = 'rejected', rejected_reason = 'referrer_internal' where rf.id = r.id;
    return query select 'ineligible'::text, r.id, r.referrer_workspace_id, null::uuid;
    return;
  end if;
  select count(*) into v_recent from public.referrals rf
    where rf.referrer_workspace_id = r.referrer_workspace_id
      and rf.status = 'rewarded'
      and rf.rewarded_at > now() - interval '30 days';
  if v_recent >= p_monthly_cap then
    update public.referrals rf
      set status = 'rejected', rejected_reason = 'monthly_cap', stripe_invoice_id = p_stripe_invoice_id
      where rf.id = r.id;
    return query select 'cap_reached'::text, r.id, r.referrer_workspace_id, null::uuid;
    return;
  end if;
  -- No invoice id on the grant: credit_grants.stripe_invoice_id is unique and
  -- the referee's own plan grant already carries this invoice.
  v_gid := public.grant_credits(r.referrer_workspace_id, p_amount, 'referral', p_expires_at, null, 'Referral reward');
  update public.referrals rf
    set status = 'rewarded', rewarded_at = now(), reward_credits = p_amount,
        stripe_invoice_id = p_stripe_invoice_id, grant_id = v_gid
    where rf.id = r.id;
  return query select 'rewarded'::text, r.id, r.referrer_workspace_id, v_gid;
end;
$$;
