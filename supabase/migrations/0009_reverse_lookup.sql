-- Reverse email lookup (day 7, F5): email-only rows can be identified (name,
-- title, company, LinkedIn) for 1 credit. A list may mix both kinds, so the
-- kind lives on the contact and the dispatcher batches per kind.

alter table public.list_contacts
  add column if not exists kind public.list_mode not null default 'enrich';

alter table public.lists
  add column if not exists reverse_lookup boolean not null default false;

comment on column public.list_contacts.kind is 'enrich = person → contact data; reverse = email → profile (1 credit when identified).';
comment on column public.lists.reverse_lookup is 'User opted in to identify email-only rows via reverse email lookup.';

create index if not exists list_contacts_list_kind_status_idx
  on public.list_contacts (list_id, kind, status);

-- Claim pending contacts of one kind for a batch (replaces the 3-arg version).
drop function if exists public.claim_pending_contacts(uuid, uuid, integer);
create or replace function public.claim_pending_contacts(p_list_id uuid, p_batch_id uuid, p_limit integer, p_kind public.list_mode default 'enrich')
returns setof public.list_contacts
language sql
security definer
set search_path = ''
as $$
  update public.list_contacts c
    set status = 'submitted', batch_id = p_batch_id
  where c.id in (
    select id from public.list_contacts
    where list_id = p_list_id and status = 'pending' and kind = p_kind
    order by row_index
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning c.*;
$$;
revoke execute on function public.claim_pending_contacts(uuid, uuid, integer, public.list_mode) from public, anon, authenticated;
grant execute on function public.claim_pending_contacts(uuid, uuid, integer, public.list_mode) to service_role;

-- Counters: identified profiles from reverse lookup.
alter table public.lists add column if not exists identified_rows integer not null default 0;

create or replace function public.recompute_list_counters(p_list_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.lists l set
    total_rows = s.total_rows,
    enrichable_rows = s.enrichable_rows,
    submitted_rows = s.submitted_rows,
    processed_rows = s.processed_rows,
    found_work_email = s.found_work_email,
    found_personal_email = s.found_personal_email,
    found_phone = s.found_phone,
    risky_email = s.risky_email,
    not_found = s.not_found,
    cached_rows = s.cached_rows,
    identified_rows = s.identified_rows,
    credits_used = s.credits_used
  from (
    select
      count(*)::int as total_rows,
      count(*) filter (where status <> 'skipped')::int as enrichable_rows,
      count(*) filter (where status in ('submitted', 'enriched', 'not_found', 'failed', 'cached'))::int as submitted_rows,
      count(*) filter (where status in ('enriched', 'not_found', 'failed', 'cached'))::int as processed_rows,
      count(*) filter (where work_email is not null and work_email_status in ('DELIVERABLE', 'HIGH_PROBABILITY'))::int as found_work_email,
      count(*) filter (where personal_email is not null)::int as found_personal_email,
      count(*) filter (where phone is not null and phone_meta ->> 'line_type' = 'MOBILE')::int as found_phone,
      count(*) filter (where work_email is not null and work_email_status = 'CATCH_ALL')::int as risky_email,
      count(*) filter (where status = 'not_found')::int as not_found,
      count(*) filter (where status = 'cached')::int as cached_rows,
      count(*) filter (where kind = 'reverse' and status = 'enriched')::int as identified_rows,
      coalesce(sum(credits_cost), 0)::int as credits_used
    from public.list_contacts c where c.list_id = p_list_id
  ) s
  where l.id = p_list_id;
$$;
