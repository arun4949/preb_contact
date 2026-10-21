-- 0028: overspend_used_this_month is only read through the service role
-- (engine tick, server actions); signed-in users never call it directly
-- (security advisor 0029).
revoke execute on function public.overspend_used_this_month(uuid) from authenticated;
