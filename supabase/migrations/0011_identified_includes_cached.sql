-- Reverse rows served from the cache are identified too.
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
      count(*) filter (where kind = 'reverse' and status in ('enriched', 'cached') and full_name is not null)::int as identified_rows,
      coalesce(sum(credits_cost), 0)::int as credits_used
    from public.list_contacts c where c.list_id = p_list_id
  ) s
  where l.id = p_list_id;
$$;

-- Refresh counters of lists that already ran a reverse lookup.
select public.recompute_list_counters(id) from public.lists where reverse_lookup;
