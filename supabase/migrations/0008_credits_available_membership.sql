-- Day-1 security advisor item: credits_available is SECURITY DEFINER and was
-- callable by any authenticated user for any workspace id. Service-role calls
-- (auth.uid() is null) are unrestricted; authenticated callers must be members.

create or replace function public.credits_available(ws uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null and not public.is_workspace_member(ws) then 0
    else
      coalesce((
        select sum(g.remaining) from public.credit_grants g
        where g.workspace_id = ws and g.expires_at > now() and g.remaining > 0
      ), 0)::integer
      - coalesce((
        select sum(h.amount) from public.credit_holds h
        where h.workspace_id = ws and h.released_at is null
      ), 0)::integer
  end;
$$;
