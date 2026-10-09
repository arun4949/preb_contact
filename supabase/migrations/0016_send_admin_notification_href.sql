-- An empty link is stored as null (PostgREST types the argument as text, so the
-- app passes '' for "no link").
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
  v_href text := nullif(trim(coalesce(p_href, '')), '');
begin
  insert into public.admin_notifications (created_by, title, body, href, audience, target_ids)
  values (p_created_by, p_title, p_body, v_href, p_audience, coalesce(p_target_ids, '{}'))
  returning admin_notifications.id into v_id;

  insert into public.notifications (user_id, kind, title, body, href, status, admin_notification_id)
  select r.user_id, 'admin', p_title, p_body, v_href, 'information', v_id
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
