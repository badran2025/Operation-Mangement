-- Transfer / role change rules:
--  * no future dates (the change shows everywhere the moment it is saved)
--  * not before the worker's current assignment started (history stays in order)
--  * a change on the same day as the current assignment corrects it instead of adding a 1-day row
--  * saving with no change does nothing
create or replace function public.transfer_worker(
  p_worker_id bigint, p_branch_id bigint, p_job_title_id bigint,
  p_start_date date default null, p_note text default null)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare d date := coalesce(p_start_date, public.riyadh_today()); cur public.worker_assignments; new_id bigint;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if d > public.riyadh_today() then raise exception 'transfer future date'; end if;
  select * into cur from public.worker_assignments where worker_id = p_worker_id and end_date is null for update;
  if found then
    if cur.branch_id = p_branch_id and cur.job_title_id is not distinct from p_job_title_id then raise exception 'transfer no change'; end if;
    if d < cur.start_date then raise exception 'transfer before current'; end if;
    if d = cur.start_date then
      update public.worker_assignments set branch_id = p_branch_id, job_title_id = p_job_title_id,
             note = coalesce(nullif(trim(p_note), ''), note)
       where id = cur.id;
      return cur.id;
    end if;
    update public.worker_assignments set end_date = d - 1 where id = cur.id;
  end if;
  insert into public.worker_assignments (worker_id, branch_id, job_title_id, start_date, note, created_by)
  values (p_worker_id, p_branch_id, p_job_title_id, d, nullif(trim(p_note), ''), auth.uid())
  returning id into new_id;
  return new_id;
end $$;
