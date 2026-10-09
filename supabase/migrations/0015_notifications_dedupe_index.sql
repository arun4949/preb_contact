-- PostgREST upserts (`on conflict (user_id, dedupe_key)`) cannot infer a partial
-- unique index, so the dedupe index is a plain unique index. NULL dedupe keys
-- never collide (nulls are distinct), which is the behaviour the partial
-- index was meant to give.
drop index if exists public.notifications_user_dedupe_idx;
create unique index notifications_user_dedupe_idx on public.notifications (user_id, dedupe_key);
