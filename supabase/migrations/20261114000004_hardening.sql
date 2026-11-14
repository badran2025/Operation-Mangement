-- Remove the one-time import function and tighten function security (Supabase advisor findings)
drop function if exists public.tmp_import_initial(text, jsonb);

alter function public.set_updated_at() set search_path = '';
alter function public.is_admin() set search_path = '';
alter function public.is_active_user() set search_path = '';
alter function public.riyadh_today() set search_path = '';
alter function public.riyadh_weekday() set search_path = '';
alter function public.transfer_worker(bigint, bigint, bigint, date, text) set search_path = '';

-- trigger functions must never be callable through the API
revoke execute on function public.audit_trigger() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- permission helpers: signed-in users only (needed by RLS policies), never anonymous
revoke execute on function public.app_role() from public, anon;
revoke execute on function public.can_see_branch(bigint) from public, anon;
revoke execute on function public.can_see_worker(bigint) from public, anon;
revoke execute on function public.can_see_ticket(bigint) from public, anon;
grant execute on function public.app_role() to authenticated;
grant execute on function public.can_see_branch(bigint) to authenticated;
grant execute on function public.can_see_worker(bigint) to authenticated;
grant execute on function public.can_see_ticket(bigint) to authenticated;
