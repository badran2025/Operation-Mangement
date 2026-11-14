-- =====================================================================
-- Maintenance module: ticket workflow RPCs, attachments storage, views
-- All ticket writes go through these functions (role rules enforced here).
-- =====================================================================

alter table public.tickets add column if not exists assignee_phone text;

-- direct writes are closed; use the RPCs below
drop policy if exists tickets_insert on public.tickets;
drop policy if exists tickets_update on public.tickets;
drop policy if exists tev_insert on public.ticket_events;
revoke insert, update on public.tickets from authenticated;
revoke insert, update on public.ticket_events from authenticated;

create or replace function public.create_ticket(
  p_branch_id bigint, p_category_id bigint, p_priority text, p_title text,
  p_description text default null, p_stops_branch boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare tid bigint; hrs int;
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor','maintenance_manager') then raise exception 'not allowed'; end if;
  if not public.can_see_branch(p_branch_id) then raise exception 'not allowed for this branch'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'العنوان مطلوب'; end if;
  select resolve_hours into hrs from public.sla_policies where priority = p_priority;
  if hrs is null then raise exception 'bad priority'; end if;

  insert into public.tickets (branch_id, category_id, priority, title, description, stops_branch, reported_by, due_at)
  values (p_branch_id, p_category_id, p_priority, trim(p_title), nullif(trim(p_description), ''), coalesce(p_stops_branch, false),
          auth.uid(), now() + make_interval(hours => hrs))
  returning id into tid;
  insert into public.ticket_events (ticket_id, kind, actor) values (tid, 'created', auth.uid());
  if p_stops_branch then
    insert into public.branch_downtimes (branch_id, started_at, reason, ticket_id, created_by)
    values (p_branch_id, now(), trim(p_title), tid, auth.uid());
  end if;
  return tid;
end $$;

create or replace function public.assign_ticket(
  p_ticket_id bigint, p_assigned_to uuid, p_assignee_name text default null, p_assignee_phone text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tickets; who text;
begin
  if coalesce(public.app_role(), '') not in ('admin','maintenance_manager') then raise exception 'not allowed'; end if;
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'not found'; end if;
  if p_assigned_to is not null then
    select full_name into who from public.profiles where id = p_assigned_to and active;
    if who is null then raise exception 'المستخدم ده مش موجود أو مش مفعّل'; end if;
  else
    who := nullif(trim(p_assignee_name), '');
  end if;
  update public.tickets set assigned_to = p_assigned_to,
         assignee_name = case when p_assigned_to is null then who end,
         assignee_phone = nullif(trim(p_assignee_phone), ''),
         status = case when status = 'new' and who is not null then 'assigned' else status end
   where id = p_ticket_id;
  insert into public.ticket_events (ticket_id, kind, from_value, to_value, actor)
  values (p_ticket_id, 'assign', coalesce((select full_name from public.profiles where id = t.assigned_to), t.assignee_name), who, auth.uid());
end $$;

create or replace function public.set_ticket_priority(p_ticket_id bigint, p_priority text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tickets; hrs int;
begin
  if coalesce(public.app_role(), '') not in ('admin','maintenance_manager') then raise exception 'not allowed'; end if;
  select * into t from public.tickets where id = p_ticket_id for update;
  select resolve_hours into hrs from public.sla_policies where priority = p_priority;
  if t.id is null or hrs is null then raise exception 'bad input'; end if;
  update public.tickets set priority = p_priority, due_at = t.created_at + make_interval(hours => hrs) where id = p_ticket_id;
  insert into public.ticket_events (ticket_id, kind, from_value, to_value, actor)
  values (p_ticket_id, 'priority', t.priority, p_priority, auth.uid());
end $$;

create or replace function public.set_ticket_status(p_ticket_id bigint, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tickets; r text := public.app_role(); ok boolean := false;
begin
  select * into t from public.tickets where id = p_ticket_id for update;
  if t.id is null or not public.can_see_ticket(p_ticket_id) then raise exception 'not allowed'; end if;
  if p_status = t.status then return; end if;

  if r in ('admin','maintenance_manager') then ok := true;
  elsif r = 'technician' and t.assigned_to = auth.uid() then
    ok := p_status in ('in_progress','waiting_parts','resolved') and t.status not in ('closed','cancelled');
  elsif r = 'supervisor' then
    ok := (p_status = 'closed' and t.status = 'resolved')
       or (p_status = 'in_progress' and t.status in ('resolved','closed'));   -- reopen
  end if;
  if not ok then raise exception 'مش مسموح لك بالتغيير ده'; end if;

  update public.tickets set
    status = p_status,
    resolved_at = case when p_status in ('resolved','closed') then coalesce(resolved_at, now())
                       when p_status in ('in_progress','assigned','waiting_parts','new') then null else resolved_at end,
    closed_at = case when p_status in ('closed','cancelled') then now() else null end
  where id = p_ticket_id;

  if p_status in ('resolved','closed','cancelled') then
    update public.branch_downtimes set ended_at = now() where ticket_id = p_ticket_id and ended_at is null;
  end if;

  insert into public.ticket_events (ticket_id, kind, from_value, to_value, body, actor)
  values (p_ticket_id, 'status', t.status, p_status, nullif(trim(p_note), ''), auth.uid());
end $$;

create or replace function public.add_ticket_comment(p_ticket_id bigint, p_body text, p_kind text default 'comment')
returns bigint language plpgsql security definer set search_path = '' as $$
declare eid bigint;
begin
  if not public.can_see_ticket(p_ticket_id) then raise exception 'not allowed'; end if;
  if p_kind not in ('comment','parts') then raise exception 'bad kind'; end if;
  insert into public.ticket_events (ticket_id, kind, body, actor)
  values (p_ticket_id, p_kind, nullif(trim(p_body), ''), auth.uid()) returning id into eid;
  return eid;
end $$;

create or replace function public.log_ticket_reminder(p_ticket_id bigint, p_channel text default 'whatsapp')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.app_role(), '') not in ('admin','maintenance_manager','supervisor') or not public.can_see_ticket(p_ticket_id) then
    raise exception 'not allowed';
  end if;
  update public.tickets set last_reminder_at = now() where id = p_ticket_id;
  insert into public.ticket_events (ticket_id, kind, body, actor) values (p_ticket_id, 'reminder', p_channel, auth.uid());
end $$;

revoke execute on function public.create_ticket(bigint,bigint,text,text,text,boolean) from public, anon;
revoke execute on function public.assign_ticket(bigint,uuid,text,text) from public, anon;
revoke execute on function public.set_ticket_priority(bigint,text) from public, anon;
revoke execute on function public.set_ticket_status(bigint,text,text) from public, anon;
revoke execute on function public.add_ticket_comment(bigint,text,text) from public, anon;
revoke execute on function public.log_ticket_reminder(bigint,text) from public, anon;
grant execute on function public.create_ticket(bigint,bigint,text,text,text,boolean) to authenticated;
grant execute on function public.assign_ticket(bigint,uuid,text,text) to authenticated;
grant execute on function public.set_ticket_priority(bigint,text) to authenticated;
grant execute on function public.set_ticket_status(bigint,text,text) to authenticated;
grant execute on function public.add_ticket_comment(bigint,text,text) to authenticated;
grant execute on function public.log_ticket_reminder(bigint,text) to authenticated;

-- ---------- list view ----------
create or replace view public.v_tickets with (security_invoker = true) as
select t.*,
       b.name_ar as branch_ar, b.city_id,
       c.name_ar as category_ar,
       coalesce(pa.full_name, t.assignee_name) as assignee_display,
       coalesce(pa.phone, t.assignee_phone) as assignee_contact,
       coalesce(pr.full_name, t.reporter_name) as reporter_display,
       (t.status not in ('resolved','closed','cancelled') and t.due_at < now()) as overdue
from public.tickets t
join public.branches b on b.id = t.branch_id
left join public.ticket_categories c on c.id = t.category_id
left join public.profiles pa on pa.id = t.assigned_to
left join public.profiles pr on pr.id = t.reported_by;
revoke all on public.v_tickets from anon;

-- branch cards: add open / overdue tickets and "stopped" flag
create or replace view public.v_branch_summary with (security_invoker = true) as
select b.id, b.name_ar, b.name_en, b.status, b.city_id, c.name_ar as city_ar, c.name_en as city_en,
       b.sort, c.sort as city_sort,
       count(w.id) filter (where w.status <> 'terminated')                         as workers_total,
       count(w.id) filter (where w.status = 'on_leave')                            as on_leave,
       count(w.id) filter (where w.status = 'active' and w.off_today)              as off_today,
       count(w.id) filter (where w.status = 'active' and not w.off_today)          as working_today,
       count(w.id) filter (where w.incomplete)                                     as incomplete,
       (select count(*) from public.tickets t where t.branch_id = b.id and t.status not in ('resolved','closed','cancelled')) as open_tickets,
       (select count(*) from public.tickets t where t.branch_id = b.id and t.status not in ('resolved','closed','cancelled') and t.due_at < now()) as overdue_tickets,
       exists (select 1 from public.branch_downtimes d where d.branch_id = b.id and d.ended_at is null) as stopped
from public.branches b
join public.cities c on c.id = b.city_id
left join public.v_workers_current w on w.branch_id = b.id
group by b.id, c.id;

-- ---------- attachments storage (private bucket; path = <ticket_id>/<file>) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-files', 'ticket-files', false, 20971520,
        array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','application/pdf'])
on conflict (id) do nothing;

create or replace function public.ticket_id_from_path(p text) returns bigint
language sql immutable set search_path = '' as $$
  select case when split_part(p, '/', 1) ~ '^[0-9]+$' then split_part(p, '/', 1)::bigint end
$$;

create policy ticket_files_read on storage.objects for select to authenticated
  using (bucket_id = 'ticket-files' and public.can_see_ticket(public.ticket_id_from_path(name)));
create policy ticket_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-files' and public.can_see_ticket(public.ticket_id_from_path(name)));
