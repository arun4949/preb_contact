-- 0019: phone number collected at onboarding (optional) + consent to one trial call.
-- Own-row-only table: `profiles` is readable by every co-member of a workspace,
-- a phone number must not be. Deleted with the account (cascade via profiles).

create table public.profile_phones (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- E.164 (max 15 digits; a few territories have valid numbers shorter than 7 digits)
  phone text not null check (phone ~ '^\+[1-9][0-9]{4,14}$'),
  -- ISO 3166-1 alpha-2 chosen in the selector
  country text not null check (country ~ '^[A-Z]{2}$'),
  calls_allowed boolean not null default true,
  -- last time the user flipped the switch (consent record)
  calls_allowed_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_phones is
  'Phone number a user gave at onboarding or in Settings. Own row only: never visible to teammates. calls_allowed = consent to one trial call (opt-out).';

create trigger profile_phones_updated_at before update on public.profile_phones
  for each row execute function public.set_updated_at();

alter table public.profile_phones enable row level security;

create policy profile_phones_select on public.profile_phones for select to authenticated
  using (user_id = (select auth.uid()));
create policy profile_phones_insert on public.profile_phones for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profile_phones_update on public.profile_phones for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profile_phones_delete on public.profile_phones for delete to authenticated
  using (user_id = (select auth.uid()));
