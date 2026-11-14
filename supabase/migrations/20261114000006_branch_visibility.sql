-- Supervisors only see their own branches (technicians/maintenance see all branch names for tickets)
drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches for select to authenticated
  using (public.can_see_branch(id) or public.app_role() = 'technician');
drop policy if exists branch_hours_read on public.branch_hours;
create policy branch_hours_read on public.branch_hours for select to authenticated
  using (public.can_see_branch(branch_id) or public.app_role() = 'technician');
