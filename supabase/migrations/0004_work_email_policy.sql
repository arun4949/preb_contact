-- Work-email policy (CTO decision, day 2): trial credits only for company
-- domains. The app blocks free-mail sign-ups; this is defense in depth so a
-- bypass can never farm credits. Keep the list in sync with
-- src/lib/auth/work-email.ts.

create or replace function public.is_free_email_domain(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    lower(split_part(p_email, '@', 2)) = any (array[
      'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.de','yahoo.fr','yahoo.co.in','ymail.com','rocketmail.com',
      'hotmail.com','hotmail.co.uk','hotmail.de','hotmail.fr','outlook.com','outlook.de','live.com','live.de','live.co.uk','msn.com',
      'icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','protonmail.ch','pm.me',
      'gmx.com','gmx.de','gmx.net','gmx.at','gmx.ch','web.de','t-online.de','freenet.de','posteo.de','mail.de',
      'mail.com','email.com','usa.com','zoho.com','zohomail.com','yandex.com','yandex.ru','mail.ru','bk.ru','inbox.ru','list.ru',
      'fastmail.com','fastmail.fm','hey.com','tutanota.com','tutamail.com','tuta.io','hushmail.com','mailfence.com',
      'qq.com','163.com','126.com','sina.com','naver.com','daum.net','hanmail.net','rediffmail.com',
      'orange.fr','wanadoo.fr','free.fr','laposte.net','sfr.fr','libero.it','virgilio.it','tiscali.it','bluewin.ch',
      'comcast.net','verizon.net','att.net','sbcglobal.net','bellsouth.net','cox.net','btinternet.com','sky.com','talktalk.net',
      'mailinator.com','guerrillamail.com','10minutemail.com','temp-mail.org','tempmail.com','throwawaymail.com','yopmail.com',
      'trashmail.com','getnada.com','dispostable.com','maildrop.cc','sharklasers.com','mohmal.com','fakeinbox.com'
    ]) or split_part(p_email, '@', 2) = '',
    true
  );
$$;
revoke execute on function public.is_free_email_domain(text) from public, anon;
grant execute on function public.is_free_email_domain(text) to authenticated, service_role;

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
    perform public.grant_credits(v_ws, 25, 'trial', now() + interval '30 days', null, 'Welcome trial');
    update public.workspaces set trial_granted_at = now() where id = v_ws;
  end if;

  return new;
end;
$$;

-- Public bucket for brand assets referenced from emails (logo). Read-only for
-- everyone; writes via service role only (no policies granted).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 2097152, array['image/png', 'image/svg+xml', 'image/jpeg'])
on conflict (id) do update set public = true;
