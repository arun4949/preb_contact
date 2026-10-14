-- 0023: keep the share URL token itself next to its hash. Admins copy the
-- link again later from /admin/leads (the chat may be weeks old). The table
-- is service-role only, the code is already stored in clear, and the hash
-- stays the lookup key for the public page.
alter table public.lead_shares add column token text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$');
comment on column public.lead_shares.token is 'URL token in clear (service role only); token_hash is the lookup key.';
