-- Self-service contact opt-out (privacy policy § 12, page "Your data and Preb"):
-- a person submits /opt-out without an account, confirms their email with a
-- one-time link, and the email lands on `contact_suppressions` at once. Phone
-- numbers and LinkedIn URLs given with the request cannot be verified, so they
-- wait in `opt_out_identifiers` until a founder approves or rejects them on
-- /admin/suppressions. Service role only throughout.

alter type public.email_kind add value if not exists 'opt_out_verify';
alter type public.email_kind add value if not exists 'opt_out_done';

-- One row per form submission. The raw email lives here only while the request
-- is pending (24 h); confirmation nulls it and keeps hash + hint + outcome as
-- the record of the request (kept 3 years by the daily job).
create table public.opt_out_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired')),
  email text,                                   -- lower-cased, only while pending
  email_hash text not null,                     -- identifierHash('email', value), same scheme as contact_suppressions.value_hash
  email_hint text not null,                     -- a***@example.com
  token_hash text not null unique,              -- sha256 hex of the confirmation link token
  expires_at timestamptz not null,
  note text check (char_length(note) <= 1000),  -- "anything we should know", e.g. which company contacted them
  cleared_rows integer,                         -- apply_contact_suppression result at confirmation
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'confirmed' or confirmed_at is not null)
);
comment on table public.opt_out_requests is 'Self-service do-not-enrich requests from /opt-out. Email verified by a one-time link; raw address kept only while pending. Confirmed rows are the record of the request (3 years). Service role only.';
create index opt_out_requests_email_hash_idx on public.opt_out_requests (email_hash);
create index opt_out_requests_pending_idx on public.opt_out_requests (expires_at) where status = 'pending';
create index opt_out_requests_created_at_idx on public.opt_out_requests (created_at);
alter table public.opt_out_requests enable row level security; -- no policies: service role only

-- Phone numbers and LinkedIn URLs from a request, awaiting founder review.
-- `value` is the normalised raw value the clearing RPC needs; nulled on review.
create table public.opt_out_identifiers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.opt_out_requests (id) on delete cascade,
  kind text not null check (kind in ('phone', 'linkedin')),
  value text,
  value_hash text not null,
  value_hint text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'pending' or reviewed_at is not null),
  unique (request_id, kind, value_hash)
);
comment on table public.opt_out_identifiers is 'Phone numbers and LinkedIn URLs a requester added on /opt-out. Not suppressed automatically: founders approve or reject them on /admin/suppressions. Service role only.';
create index opt_out_identifiers_request_id_idx on public.opt_out_identifiers (request_id);
create index opt_out_identifiers_pending_idx on public.opt_out_identifiers (created_at) where status = 'pending';
create index opt_out_identifiers_reviewed_by_idx on public.opt_out_identifiers (reviewed_by) where reviewed_by is not null;
alter table public.opt_out_identifiers enable row level security; -- no policies: service role only

-- Provenance of a suppression: added by a founder, or by the person themselves.
alter table public.contact_suppressions
  add column source text not null default 'admin' check (source in ('admin', 'opt_out')),
  add column request_id uuid references public.opt_out_requests (id) on delete set null;
create index contact_suppressions_request_id_idx on public.contact_suppressions (request_id) where request_id is not null;

-- settle_batch: suppressed rows now carry credits_cost 0 and the batch charge is
-- reduced by their provider cost (the customer is not charged for people who
-- objected). Same function as 0006, except the leftover fallback never lands
-- credits on a suppressed row.
create or replace function public.settle_batch(p_batch_id uuid)
returns table (charged integer, consumed integer, derived integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  c record;
  v_derived integer;
  v_charged integer;
  v_taken integer;
  v_short integer;
  v_left integer;
  v_last uuid;
begin
  select * into b from public.enrichment_batches
    where id = p_batch_id and settled_at is null and status <> 'submitted'
    for update skip locked;
  if not found then
    return;
  end if;

  select coalesce(sum(lc.credits_cost), 0)::int into v_derived
    from public.list_contacts lc where lc.batch_id = p_batch_id;
  v_charged := coalesce(b.credits_cost, v_derived);

  v_taken := public.consume_credits(b.workspace_id, v_charged, b.list_id, p_batch_id);
  v_short := v_charged - v_taken;
  if v_short > 0 then
    insert into public.credit_ledger (workspace_id, list_id, batch_id, kind, delta, note)
      values (b.workspace_id, b.list_id, p_batch_id, 'adjust', -v_short, 'Overdraft absorbed');
  end if;

  if v_charged <> v_derived then
    insert into public.credit_ledger (workspace_id, list_id, batch_id, kind, delta, note)
      values (b.workspace_id, b.list_id, p_batch_id, 'adjust', 0,
              format('Provider charged %s credits, per-contact derivation says %s', v_charged, v_derived));
    -- Allocate the real charge in row order, capped by each contact's derived
    -- cost; any excess lands on the last charged contact (never a suppressed one).
    v_left := v_charged;
    for c in
      select id, credits_cost from public.list_contacts
      where batch_id = p_batch_id
      order by row_index
      for update
    loop
      update public.list_contacts set credits_cost = least(c.credits_cost, v_left) where id = c.id;
      if c.credits_cost > 0 then v_last := c.id; end if;
      v_left := v_left - least(c.credits_cost, v_left);
    end loop;
    if v_left > 0 then
      if v_last is null then
        select id into v_last from public.list_contacts
          where batch_id = p_batch_id and skip_reason is distinct from 'suppressed'
          order by row_index desc limit 1;
      end if;
      if v_last is not null then
        update public.list_contacts set credits_cost = credits_cost + v_left where id = v_last;
      end if;
    end if;
  end if;

  update public.credit_holds
    set amount = greatest(0, amount - v_charged)
    where list_id = b.list_id and released_at is null;

  update public.enrichment_batches
    set settled_at = now(), credits_cost = v_charged
    where id = p_batch_id;

  return query select v_charged, v_taken, v_derived;
end;
$$;
revoke execute on function public.settle_batch(uuid) from public, anon, authenticated;
grant execute on function public.settle_batch(uuid) to service_role;
