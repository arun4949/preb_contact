-- Trigger functions are never called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.list_contacts_counters_trigger() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
