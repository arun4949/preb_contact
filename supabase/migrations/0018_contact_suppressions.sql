-- Contact suppression list (privacy policy § 12, Terms 9.5, DPA 9.3): people
-- who object are identified by a hashed email, LinkedIn URL or phone number.
-- The app skips them at upload, discards provider results that match, and
-- `apply_contact_suppression` clears what is already stored. Service role only.

create table public.contact_suppressions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email', 'linkedin', 'phone')),
  value_hash text not null,                 -- sha256 hex of kind || ':' || normalised value
  value_hint text not null,                 -- masked form for the admin list, e.g. a***@example.com
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, value_hash)
);
alter table public.contact_suppressions enable row level security; -- no policies: service role only

-- Scan indexes for the clearing pass (lookups are exact on lower-cased values).
create index list_contacts_email_input_lower_idx on public.list_contacts (lower(email_input)) where email_input is not null;
create index list_contacts_work_email_lower_idx on public.list_contacts (lower(work_email)) where work_email is not null;
create index list_contacts_personal_email_lower_idx on public.list_contacts (lower(personal_email)) where personal_email is not null;
create index list_contacts_linkedin_lower_idx on public.list_contacts (lower(linkedin_url)) where linkedin_url is not null;

-- Clears every stored result and identifier of a suppressed person.
--   p_kind   'email' | 'linkedin' | 'phone'
--   p_value  normalised value: lower-cased email, lower-cased canonical
--            LinkedIn URL, or phone digits only
--   p_cache_hashes  enrichment_cache input hashes to drop (computed by the app)
-- Rows keep their credits_cost so list totals still reconcile with the ledger.
create or replace function public.apply_contact_suppression(p_kind text, p_value text, p_cache_hashes text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_handle text;
  v_phone_pattern text;
begin
  if p_kind = 'email' then
    with hit as (
      update public.list_contacts c
      set work_email = null, work_email_status = null, personal_email = null, personal_email_status = null,
          phone = null, phone_meta = null, job_title = null, company = null, company_domain = null,
          company_logo_url = null, location = null, profile = null, result = null,
          email_input = case when lower(c.email_input) = p_value then null else c.email_input end,
          raw = coalesce((select jsonb_object_agg(e.key, case when lower(e.value) = p_value then '' else e.value end) from jsonb_each_text(c.raw) e), '{}'::jsonb),
          status = 'skipped', skip_reason = 'suppressed'
      where lower(c.email_input) = p_value or lower(c.work_email) = p_value or lower(c.personal_email) = p_value
      returning 1
    ) select count(*) into v_count from hit;
    delete from public.enrichment_cache where input_hash = any (p_cache_hashes) or lower(result::text) like '%' || p_value || '%';

  elsif p_kind = 'linkedin' then
    v_handle := lower(regexp_replace(p_value, '^.*/in/', ''));
    with hit as (
      update public.list_contacts c
      set work_email = null, work_email_status = null, personal_email = null, personal_email_status = null,
          phone = null, phone_meta = null, job_title = null, company = null, company_domain = null,
          company_logo_url = null, location = null, profile = null, result = null,
          linkedin_url = null,
          raw = coalesce((select jsonb_object_agg(e.key, case when lower(e.value) like '%/in/' || v_handle || '%' then '' else e.value end) from jsonb_each_text(c.raw) e), '{}'::jsonb),
          status = 'skipped', skip_reason = 'suppressed'
      where lower(c.linkedin_url) like '%/in/' || v_handle || '%'
      returning 1
    ) select count(*) into v_count from hit;
    delete from public.enrichment_cache where input_hash = any (p_cache_hashes) or lower(result::text) like '%/in/' || v_handle || '%';

  elsif p_kind = 'phone' then
    -- digits with any separators between them, e.g. "+1 555-123-4567"
    v_phone_pattern := regexp_replace(p_value, '(.)', '\1[^0-9]{0,2}', 'g');
    with hit as (
      update public.list_contacts c
      set work_email = null, work_email_status = null, personal_email = null, personal_email_status = null,
          phone = null, phone_meta = null, job_title = null, company = null, company_domain = null,
          company_logo_url = null, location = null, profile = null, result = null,
          raw = coalesce((select jsonb_object_agg(e.key, case when regexp_replace(e.value, '[^0-9]', '', 'g') = p_value then '' else e.value end) from jsonb_each_text(c.raw) e), '{}'::jsonb),
          status = 'skipped', skip_reason = 'suppressed'
      where c.phone is not null and regexp_replace(c.phone, '[^0-9]', '', 'g') = p_value
      returning 1
    ) select count(*) into v_count from hit;
    delete from public.enrichment_cache where input_hash = any (p_cache_hashes) or result::text ~ v_phone_pattern;
  end if;

  return v_count;
end;
$$;
revoke execute on function public.apply_contact_suppression(text, text, text[]) from public, anon, authenticated;
grant execute on function public.apply_contact_suppression(text, text, text[]) to service_role;
