-- In-app notifications (header bell) and admin announcements.
--
-- notifications        one row per recipient; the bell reads the signed-in
--                      user's rows through RLS and marks them read.
-- admin_notifications  announcements written by Preb admins; fanned out into
--                      notifications by send_admin_notification().
-- Team joins are produced by a trigger on workspace_members so both join
-- paths (signup through an invite inside handle_new_user, and acceptInvite for
-- existing users) are covered without touching handle_new_user.

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  body text not null,
  href text,
  audience text not null check (audience in ('all', 'users', 'workspaces')),
  target_ids uuid[] not null default '{}',
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index admin_notifications_created_idx on public.admin_notifications (created_at desc);
create index admin_notifications_created_by_idx on public.admin_notifications (created_by);
alter table public.admin_notifications enable row level security;
-- No policies: service role only.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  -- text + check instead of an enum: enum values cannot be added inside the
  -- transaction a migration runs in.
  kind text not null check (kind in (
    'admin',
    'member_joined', 'member_welcome', 'member_left', 'member_removed', 'role_changed',
    'list_finished', 'list_stopped', 'list_paused_credits', 'list_paused_upstream', 'list_failed',
    'credits_low', 'credits_granted', 'credits_expiring', 'trial_ending',
    'plan_started', 'plan_changed', 'plan_cancel_scheduled', 'plan_cancel_reverted', 'plan_canceled'
  )),
  title text not null,
  body text not null default '',
  href text,
  status text not null default 'neutral' check (status in ('neutral', 'information', 'success', 'error')),
  dedupe_key text,
  admin_notification_id uuid references public.admin_notifications(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create unique index notifications_user_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index notifications_admin_idx on public.notifications (admin_notification_id) where admin_notification_id is not null;
create index notifications_workspace_idx on public.notifications (workspace_id);
create index notifications_created_idx on public.notifications (created_at);

alter table public.notifications enable row level security;

-- Join-free policies: Realtime evaluates them per subscriber for every change.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Only read_at may change from the app; everything else is service role.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke insert, delete on public.notifications from authenticated, anon;
revoke all on public.admin_notifications from authenticated, anon;

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Team joins
-- ---------------------------------------------------------------------------
create or replace function public.notify_member_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_ws_name text;
begin
  -- An owner row is a workspace creation, not a join.
  if new.role = 'owner' then
    return new;
  end if;

  select coalesce(nullif(p.full_name, ''), p.email) into v_name from public.profiles p where p.id = new.user_id;
  select w.name into v_ws_name from public.workspaces w where w.id = new.workspace_id;
  if v_name is null or v_ws_name is null then
    return new;
  end if;

  insert into public.notifications (user_id, workspace_id, kind, title, body, href, status)
  select m.user_id, new.workspace_id, 'member_joined',
         v_name || ' joined ' || v_ws_name,
         'They can now see the lists in this workspace.',
         '/lists?settings=workspace', 'information'
  from public.workspace_members m
  where m.workspace_id = new.workspace_id and m.user_id <> new.user_id;

  insert into public.notifications (user_id, workspace_id, kind, title, body, href, status)
  values (new.user_id, new.workspace_id, 'member_welcome',
          'Welcome to ' || v_ws_name,
          'You joined as ' || case when new.role = 'admin' then 'an admin' else 'a member' end || '. Upload a list or enrich a single contact to get started.',
          '/lists', 'success');
  return new;
end;
$$;

revoke execute on function public.notify_member_joined() from public, anon, authenticated;

create trigger workspace_members_notify_joined
  after insert on public.workspace_members
  for each row execute function public.notify_member_joined();

-- ---------------------------------------------------------------------------
-- Admin announcements: one statement fans the announcement out to every
-- recipient. Service role only.
-- ---------------------------------------------------------------------------
create or replace function public.send_admin_notification(
  p_created_by uuid,
  p_title text,
  p_body text,
  p_href text,
  p_audience text,
  p_target_ids uuid[]
)
returns table (id uuid, recipient_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer;
begin
  insert into public.admin_notifications (created_by, title, body, href, audience, target_ids)
  values (p_created_by, p_title, p_body, p_href, p_audience, coalesce(p_target_ids, '{}'))
  returning admin_notifications.id into v_id;

  insert into public.notifications (user_id, kind, title, body, href, status, admin_notification_id)
  select r.user_id, 'admin', p_title, p_body, p_href, 'information', v_id
  from (
    select p.id as user_id from public.profiles p where p_audience = 'all'
    union
    select p.id from public.profiles p where p_audience = 'users' and p.id = any(coalesce(p_target_ids, '{}'))
    union
    select m.user_id from public.workspace_members m where p_audience = 'workspaces' and m.workspace_id = any(coalesce(p_target_ids, '{}'))
  ) r;
  get diagnostics v_count = row_count;

  update public.admin_notifications a set recipient_count = v_count where a.id = v_id;
  return query select v_id, v_count;
end;
$$;

revoke execute on function public.send_admin_notification(uuid, text, text, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.send_admin_notification(uuid, text, text, text, text, uuid[]) to service_role;
