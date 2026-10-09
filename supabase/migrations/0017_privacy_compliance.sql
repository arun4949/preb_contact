-- Privacy compliance (2026-10-09, legal counsel review): the app must match the
-- privacy policy in docs/legal/privacy-policy.md.
--   A. enrichment_cache becomes a per-workspace store (Preb acts as processor
--      only): key (workspace_id, input_hash), rows disappear with the workspace.
--   B. profiles.product_news: opt-out flag for product news (Resend broadcasts).
--   C. Self-service deletion: deleted_accounts tombstones keep the
--      one-trial-per-person rule for 12 months (hashed email, Google id only),
--      and a 'workspace_deleted' notification kind for remaining members.

-- A. Per-workspace enrichment cache ------------------------------------------
delete from public.enrichment_cache where source_workspace_id is null;
alter table public.enrichment_cache rename column source_workspace_id to workspace_id;
alter table public.enrichment_cache alter column workspace_id set not null;
alter table public.enrichment_cache drop constraint enrichment_cache_source_workspace_id_fkey;
alter table public.enrichment_cache
  add constraint enrichment_cache_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete cascade;
alter table public.enrichment_cache drop constraint enrichment_cache_pkey;
alter table public.enrichment_cache add primary key (workspace_id, input_hash);
drop index if exists public.enrichment_cache_source_workspace_id_idx; -- covered by the new primary key

-- B. Product news preference ---------------------------------------------------
alter table public.profiles add column product_news boolean not null default true;

-- C. Deletion ------------------------------------------------------------------
create table public.deleted_accounts (
  email_hash text primary key,          -- sha256 hex of the lower-cased email
  google_provider_id text,
  deleted_at timestamptz not null default now()
);
create index deleted_accounts_google_idx on public.deleted_accounts (google_provider_id);
create index deleted_accounts_deleted_at_idx on public.deleted_accounts (deleted_at);
alter table public.deleted_accounts enable row level security; -- no policies: service role only

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'admin',
  'member_joined', 'member_welcome', 'member_left', 'member_removed', 'role_changed', 'workspace_deleted',
  'list_finished', 'list_stopped', 'list_paused_credits', 'list_paused_upstream', 'list_failed',
  'credits_low', 'credits_granted', 'credits_expiring', 'trial_ending',
  'plan_started', 'plan_changed', 'plan_cancel_scheduled', 'plan_cancel_reverted', 'plan_canceled'
));

-- handle_new_user: identical to 0012 plus the tombstone guard.
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
  v_email_hash text := encode(sha256(convert_to(v_email, 'UTF8')), 'hex');
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

  -- Trial abuse guard: same Google identity already used, >= 3 trials from
  -- this email domain in 30 days, or an account deleted in the last 12 months.
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
  if v_trial_ok and exists (
    select 1 from public.deleted_accounts d
    where d.deleted_at > now() - interval '12 months'
      and (d.email_hash = v_email_hash or (v_provider_id is not null and d.google_provider_id = v_provider_id))
  ) then
    v_trial_ok := false;
  end if;

  if v_trial_ok then
    perform public.grant_credits(v_ws, 50, 'trial', now() + interval '30 days', null, 'Welcome trial');
    update public.workspaces set trial_granted_at = now() where id = v_ws;
  end if;

  return new;
end;
$$;
