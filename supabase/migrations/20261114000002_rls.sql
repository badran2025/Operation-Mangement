-- =====================================================================
-- Row Level Security: permissions enforced inside the database.
-- Roles: admin (operations manager) | supervisor | maintenance_manager | technician
-- Inactive accounts see nothing.
-- =====================================================================

create or replace function public.app_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.app_role() = 'admin', false) $$;

create or replace function public.is_active_user() returns boolean
language sql stable as $$ select public.app_role() is not null $$;

create or replace function public.can_see_branch(bid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select case public.app_role()
    when 'admin' then true
    when 'maintenance_manager' then true
    when 'supervisor' then exists (select 1 from public.profile_branches pb
                                   where pb.profile_id = auth.uid() and pb.branch_id = bid)
    else false end
$$;

create or replace function public.can_see_worker(wid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (public.app_role() = 'supervisor' and exists (
    select 1 from public.worker_assignments a
    join public.profile_branches pb on pb.branch_id = a.branch_id and pb.profile_id = auth.uid()
    where a.worker_id = wid and a.end_date is null))
$$;

create or replace function public.can_see_ticket(tid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tickets t where t.id = tid and (
    public.app_role() in ('admin','maintenance_manager')
    or (public.app_role() = 'technician' and t.assigned_to = auth.uid())
    or (public.app_role() = 'supervisor' and public.can_see_branch(t.branch_id))))
$$;

-- enable RLS everywhere
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- reference data: readable by any active user, editable by admin ----------
do $$
declare t text;
begin
  foreach t in array array['cities','branches','branch_hours','job_titles','ticket_categories','sla_policies'] loop
    execute format('create policy "%1$s_read" on public.%1$s for select to authenticated using (public.is_active_user())', t);
    execute format('create policy "%1$s_admin" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------- profiles ----------
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_user());
create policy profiles_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy pb_read on public.profile_branches for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy pb_admin on public.profile_branches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- branch files & downtimes ----------
create policy bf_read on public.branch_files for select to authenticated using (public.can_see_branch(branch_id));
create policy bf_write on public.branch_files for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy dt_read on public.branch_downtimes for select to authenticated using (public.can_see_branch(branch_id));
create policy dt_insert on public.branch_downtimes for insert to authenticated
  with check (public.can_see_branch(branch_id) and created_by = auth.uid());
create policy dt_update on public.branch_downtimes for update to authenticated
  using (public.app_role() in ('admin','maintenance_manager') or (public.can_see_branch(branch_id) and created_by = auth.uid()));
create policy dt_delete on public.branch_downtimes for delete to authenticated using (public.is_admin());

-- ---------- housing ----------
create policy housing_read on public.housings for select to authenticated
  using (public.app_role() in ('admin','supervisor'));
create policy housing_admin on public.housings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- workers & schedule ----------
create policy workers_read on public.workers for select to authenticated using (public.can_see_worker(id));
create policy workers_admin on public.workers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['worker_assignments','worker_shift_segments','worker_days_off','worker_coverages'] loop
    execute format('create policy "%1$s_read" on public.%1$s for select to authenticated using (public.can_see_worker(worker_id))', t);
    execute format('create policy "%1$s_admin" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- documents (iqama, passport...) — admin only
create policy docs_admin on public.worker_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- diesel ----------
create policy diesel_read on public.diesel_refuels for select to authenticated using (public.can_see_branch(branch_id));
create policy diesel_insert on public.diesel_refuels for insert to authenticated
  with check (public.app_role() in ('admin','supervisor') and public.can_see_branch(branch_id) and created_by = auth.uid());
create policy diesel_admin on public.diesel_refuels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy dfiles_read on public.diesel_refuel_files for select to authenticated
  using (exists (select 1 from public.diesel_refuels r where r.id = refuel_id and public.can_see_branch(r.branch_id)));
create policy dfiles_insert on public.diesel_refuel_files for insert to authenticated
  with check (exists (select 1 from public.diesel_refuels r where r.id = refuel_id and r.created_by = auth.uid()) or public.is_admin());

-- ---------- tickets ----------
create policy tickets_read on public.tickets for select to authenticated using (public.can_see_ticket(id));
create policy tickets_insert on public.tickets for insert to authenticated
  with check (public.can_see_branch(branch_id) and reported_by = auth.uid());
create policy tickets_update on public.tickets for update to authenticated
  using (public.can_see_ticket(id));
create policy tickets_delete on public.tickets for delete to authenticated using (public.is_admin());

create policy tev_read on public.ticket_events for select to authenticated using (public.can_see_ticket(ticket_id));
create policy tev_insert on public.ticket_events for insert to authenticated
  with check (public.can_see_ticket(ticket_id) and actor = auth.uid());

create policy tatt_read on public.ticket_attachments for select to authenticated using (public.can_see_ticket(ticket_id));
create policy tatt_insert on public.ticket_attachments for insert to authenticated
  with check (public.can_see_ticket(ticket_id) and uploaded_by = auth.uid());

create policy notif_read on public.notifications for select to authenticated
  using (recipient = auth.uid() or public.app_role() in ('admin','maintenance_manager'));

-- ---------- audit log: read by admin only; written only by trigger ----------
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- anon (not logged in) gets nothing at all
revoke all on all tables in schema public from anon;
