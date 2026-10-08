-- Pricing v2 (2026-10-08): 1 Preb credit = ½ provider credit. Per-result costs
-- double (2 / 6 / 20 / reverse 2), plans are 2× credits in EUR, trial 25 → 50.
-- This migration (a) raises the trial grant to 50 and (b) doubles every
-- credit-denominated value already in the database once, so existing balances
-- keep their real value. Guarded by a marker row so a re-run is a no-op.

-- (a) handle_new_user: identical to 0004 except the trial amount.
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
  v_free boolean := public.is_free_email_domain(v_email);
  v_invite record;
  v_ws uuid;
  v_ws_name text;
  v_slug text;
  v_trial_ok boolean := not v_free; -- free-mail domains never receive a trial
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
    when v_free then coalesce(v_name, 'My') || '''s workspace'
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
  -- this email domain in 30 days.
  if v_trial_ok and v_provider_id is not null and exists (
    select 1 from auth.identities i where i.provider_id = v_provider_id and i.user_id <> new.id
  ) then
    v_trial_ok := false;
  end if;
  if v_trial_ok and (
    select count(*) from public.workspaces w
    join public.profiles p on p.id = w.owner_id
    where w.trial_granted_at > now() - interval '30 days'
      and split_part(p.email, '@', 2) = v_domain
  ) >= 3 then
    v_trial_ok := false;
  end if;

  if v_trial_ok then
    perform public.grant_credits(v_ws, 50, 'trial', now() + interval '30 days', null, 'Welcome trial');
    update public.workspaces set trial_granted_at = now() where id = v_ws;
  end if;

  return new;
end;
$$;

-- (b) One-off data conversion to the new unit.
do $$
begin
  if exists (select 1 from public.webhook_events where provider = 'migration' and external_id = 'pricing_v2') then
    raise notice 'pricing_v2: data already converted, skipping';
    return;
  end if;

  update public.credit_grants set amount = amount * 2, remaining = remaining * 2;
  update public.credit_holds set amount = amount * 2;
  update public.credit_ledger set delta = delta * 2;
  update public.list_contacts set credits_cost = credits_cost * 2 where credits_cost <> 0;
  update public.enrichment_batches set credits_cost = credits_cost * 2 where credits_cost is not null;
  -- credits_used is NOT doubled here: the list_contacts update above already
  -- re-derived it through the counters trigger (Σ credits_cost). The first
  -- apply doubled it twice and was corrected with recompute_list_counters().
  update public.lists
    set credits_estimated = credits_estimated * 2,
        credits_max = credits_max * 2;

  -- v1 subscriptions (USD `pro_*` plans) are retired; the only one was the
  -- CTO's test purchase, already canceled in Stripe.
  update public.workspaces
    set plan_key = null,
        stripe_subscription_id = null,
        subscription_status = null,
        cancel_at_period_end = false,
        current_period_end = null
    where plan_key like 'pro_%';

  insert into public.webhook_events (provider, external_id, payload, processed_at)
    values ('migration', 'pricing_v2', jsonb_build_object('applied_at', now(), 'multiplier', 2), now());
end;
$$;
