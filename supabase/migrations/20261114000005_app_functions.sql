-- Email on profiles (for the admin users page) + app RPCs

alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Admin: activate / change role / assign branches. Also confirms the email so the person can log in.
create or replace function public.admin_update_user(
  p_user uuid, p_role text, p_active boolean, p_branch_ids bigint[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_user = auth.uid() and (not p_active or p_role <> 'admin') then
    raise exception 'لا يمكنك إلغاء صلاحية الأدمن عن نفسك';
  end if;
  update public.profiles set role = p_role, active = p_active where id = p_user;
  if p_active then
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = p_user;
  end if;
  delete from public.profile_branches where profile_id = p_user;
  insert into public.profile_branches (profile_id, branch_id)
  select p_user, unnest(coalesce(p_branch_ids, '{}'));
end $$;
revoke execute on function public.admin_update_user(uuid, text, boolean, bigint[]) from public, anon;
grant execute on function public.admin_update_user(uuid, text, boolean, bigint[]) to authenticated;

-- Save a worker's weekly schedule atomically. p_shifts = [{"start":"09:00","end":"21:00"}, ...]
create or replace function public.save_worker_schedule(
  p_worker_id bigint, p_shifts jsonb, p_days_off smallint[], p_no_day_off boolean, p_break_time time default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare s jsonb; i int := 0;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  delete from public.worker_shift_segments where worker_id = p_worker_id;
  for s in select * from jsonb_array_elements(coalesce(p_shifts, '[]')) loop
    i := i + 1;
    insert into public.worker_shift_segments (worker_id, seq, start_time, end_time)
    values (p_worker_id, i, (s->>'start')::time, (s->>'end')::time);
  end loop;
  delete from public.worker_days_off where worker_id = p_worker_id;
  insert into public.worker_days_off (worker_id, weekday)
  select p_worker_id, d from unnest(coalesce(p_days_off, '{}')) d where d between 0 and 6
  on conflict do nothing;
  update public.workers set no_day_off = coalesce(p_no_day_off, false), break_time = p_break_time
   where id = p_worker_id;
end $$;
revoke execute on function public.save_worker_schedule(bigint, jsonb, smallint[], boolean, time) from public, anon;
grant execute on function public.save_worker_schedule(bigint, jsonb, smallint[], boolean, time) to authenticated;

revoke execute on function public.transfer_worker(bigint, bigint, bigint, date, text) from public, anon;
grant execute on function public.transfer_worker(bigint, bigint, bigint, date, text) to authenticated;

-- views must not be reachable without login
revoke all on public.v_workers_current, public.v_branch_summary from anon;
