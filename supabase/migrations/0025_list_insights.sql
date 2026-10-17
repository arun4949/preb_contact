-- Per-list breakdown of enrichment results for the list page: summary cards,
-- filter chips (email levels, phone line type / connect rate / ownership) and
-- the number of contacts with more than one candidate. Read-only and
-- security invoker, so the list_contacts RLS policy applies to signed-in
-- members; the public lead share page calls it with the service role.
create or replace function public.list_result_insights(p_list_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with c as (
    select
      status, kind, full_name,
      work_email, work_email_status,
      personal_email, personal_email_status,
      phone, phone_meta,
      case when jsonb_typeof(result -> 'contact_info' -> 'work_emails') = 'array'
           then result -> 'contact_info' -> 'work_emails' else '[]'::jsonb end as work_emails,
      case when jsonb_typeof(result -> 'contact_info' -> 'personal_emails') = 'array'
           then result -> 'contact_info' -> 'personal_emails' else '[]'::jsonb end as personal_emails,
      case when jsonb_typeof(result -> 'contact_info' -> 'phones') = 'array'
           then result -> 'contact_info' -> 'phones' else '[]'::jsonb end as phones
    from public.list_contacts
    where list_id = p_list_id
  ),
  per_row as (
    select c.*,
      (select count(distinct e ->> 'email') from jsonb_array_elements(c.work_emails) e
        where e ->> 'status' in ('DELIVERABLE', 'HIGH_PROBABILITY', 'CATCH_ALL')) as work_candidates,
      (select count(distinct e ->> 'email') from jsonb_array_elements(c.personal_emails) e
        where e ->> 'status' in ('DELIVERABLE', 'HIGH_PROBABILITY', 'CATCH_ALL')) as personal_candidates,
      (select count(distinct p ->> 'number') from jsonb_array_elements(c.phones) p
        where coalesce(p ->> 'line_status', '') <> 'INACTIVE') as phone_candidates
    from c
  )
  select jsonb_build_object(
    'processed', count(*) filter (where status in ('enriched', 'not_found', 'failed', 'cached')),
    'work_email', jsonb_build_object(
      'valid',     count(*) filter (where work_email is not null and work_email_status = 'DELIVERABLE'),
      'probable',  count(*) filter (where work_email is not null and work_email_status = 'HIGH_PROBABILITY'),
      'catch_all', count(*) filter (where work_email is not null and work_email_status = 'CATCH_ALL'),
      'not_found', count(*) filter (where status in ('enriched', 'not_found', 'failed', 'cached') and work_email is null),
      'multi',     count(*) filter (where work_email is not null and work_candidates > 1)),
    'personal_email', jsonb_build_object(
      'valid',     count(*) filter (where personal_email is not null and personal_email_status = 'DELIVERABLE'),
      'probable',  count(*) filter (where personal_email is not null and personal_email_status = 'HIGH_PROBABILITY'),
      'catch_all', count(*) filter (where personal_email is not null and personal_email_status = 'CATCH_ALL'),
      'not_found', count(*) filter (where status in ('enriched', 'not_found', 'failed', 'cached') and personal_email is null),
      'multi',     count(*) filter (where personal_email is not null and personal_candidates > 1)),
    'phone', jsonb_build_object(
      'found',     count(*) filter (where phone is not null),
      'not_found', count(*) filter (where status in ('enriched', 'not_found', 'failed', 'cached') and phone is null),
      'mobile',    count(*) filter (where phone is not null and phone_meta ->> 'line_type' = 'MOBILE'),
      'landline',  count(*) filter (where phone is not null and phone_meta ->> 'line_type' = 'LANDLINE'),
      'voip',      count(*) filter (where phone is not null and phone_meta ->> 'line_type' = 'VOIP'),
      'unknown_type', count(*) filter (where phone is not null and coalesce(phone_meta ->> 'line_type', 'UNKNOWN') not in ('MOBILE', 'LANDLINE', 'VOIP')),
      'connect', jsonb_build_object(
        'highest', count(*) filter (where phone is not null and phone_meta ->> 'connect_rate' = 'HIGHEST'),
        'high',    count(*) filter (where phone is not null and phone_meta ->> 'connect_rate' = 'HIGH'),
        'medium',  count(*) filter (where phone is not null and phone_meta ->> 'connect_rate' = 'MEDIUM'),
        'unrated', count(*) filter (where phone is not null and phone_meta ->> 'connect_rate' is null)),
      'ownership', jsonb_build_object(
        'confirmed', count(*) filter (where phone is not null and phone_meta ->> 'ownership_match' = 'CONFIRMED'),
        'mismatch',  count(*) filter (where phone is not null and phone_meta ->> 'ownership_match' = 'MISMATCH'),
        'unknown',   count(*) filter (where phone is not null and phone_meta ->> 'ownership_match' is null)),
      'multi',     count(*) filter (where phone is not null and phone_candidates > 1)),
    'identified', count(*) filter (where kind = 'reverse' and status in ('enriched', 'cached') and full_name is not null)
  )
  from per_row;
$$;

comment on function public.list_result_insights(uuid) is
  'Read-only result breakdown for the list page (email levels, phone signals, multi-candidate counts). RLS applies.';

revoke execute on function public.list_result_insights(uuid) from public, anon;
grant execute on function public.list_result_insights(uuid) to authenticated, service_role;
