-- =====================================================================
-- Ticket workflow rules (enforced in the database, not only in the UI)
--
--   new ──assign──▶ assigned ──▶ in_progress ◀──▶ waiting_parts (on hold, reason required)
--                                    │
--                                    ▼
--                                resolved ──confirm──▶ closed
--                                    ▲                    │
--                                    └──── reopen (reason required) ◀──┘
--   any open stage ──▶ cancelled (manager only, reason required)
--
-- A ticket can never be assigned / in progress / on hold / resolved
-- without a named technician.
-- =====================================================================

alter table public.tickets add column if not exists hold_reason text;

-- Legacy tickets were imported as "assigned" / "in progress" with nobody named.
-- Put them back at the start of the workflow so someone gets assigned.
with old as (
  select id, status from public.tickets
   where status in ('assigned','in_progress','waiting_parts','resolved')
     and assigned_to is null and assignee_name is null
), log as (
  insert into public.ticket_events (ticket_id, kind, from_value, to_value, body)
  select id, 'status', status, 'new', 'لم يُسجَّل فني مسؤول عن البلاغ · No technician was recorded for this ticket' from old
)
update public.tickets t set status = 'new' from old where t.id = old.id;

alter table public.tickets drop constraint if exists tickets_needs_assignee;
alter table public.tickets add constraint tickets_needs_assignee check (
  status not in ('assigned','in_progress','waiting_parts','resolved')
  or assigned_to is not null or assignee_name is not null);

-- ---------- assign ----------
create or replace function public.assign_ticket(
  p_ticket_id bigint, p_assigned_to uuid, p_assignee_name text default null, p_assignee_phone text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tickets; who text; prev text;
begin
  if coalesce(public.app_role(), '') not in ('admin','maintenance_manager') then raise exception 'not allowed'; end if;
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'not found'; end if;
  if t.status in ('closed','cancelled') then raise exception 'ticket is closed'; end if;
  if p_assigned_to is not null then
    select full_name into who from public.profiles where id = p_assigned_to and active;
    if who is null then raise exception 'المستخدم ده مش موجود أو مش مفعّل'; end if;
  else
    who := nullif(trim(p_assignee_name), '');
  end if;
  -- taking the technician off is only possible before work starts
  if who is null and t.status not in ('new','assigned') then raise exception 'needs assignee'; end if;
  prev := coalesce((select full_name from public.profiles where id = t.assigned_to), t.assignee_name);

  update public.tickets set assigned_to = p_assigned_to,
         assignee_name = case when p_assigned_to is null then who end,
         assignee_phone = case when who is null then null else nullif(trim(p_assignee_phone), '') end,
         status = case when who is null then 'new' when status = 'new' then 'assigned' else status end
   where id = p_ticket_id;
  if prev is distinct from who then
    insert into public.ticket_events (ticket_id, kind, from_value, to_value, actor)
    values (p_ticket_id, 'assign', prev, who, auth.uid());
  end if;
end $$;

-- ---------- status ----------
create or replace function public.set_ticket_status(p_ticket_id bigint, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tickets; r text := public.app_role(); note text := nullif(trim(p_note), '');
        has_tech boolean; target text := p_status; ok boolean := false;
begin
  select * into t from public.tickets where id = p_ticket_id for update;
  if t.id is null or not public.can_see_ticket(p_ticket_id) then raise exception 'not allowed'; end if;
  has_tech := t.assigned_to is not null or t.assignee_name is not null;
  -- reopening a cancelled ticket goes back to the right starting stage
  if t.status = 'cancelled' and target in ('new','assigned') then
    target := case when has_tech then 'assigned' else 'new' end;
  end if;
  if target = t.status then return; end if;

  -- 1) is this a real step in the workflow?
  ok := case t.status
    when 'new'           then target = 'cancelled'
    when 'assigned'      then target in ('in_progress','waiting_parts','resolved','cancelled')
    when 'in_progress'   then target in ('waiting_parts','resolved','cancelled')
    when 'waiting_parts' then target in ('in_progress','resolved','cancelled')
    when 'resolved'      then target in ('closed','in_progress')
    when 'closed'        then target = 'in_progress'
    when 'cancelled'     then target in ('new','assigned')
    else false end;
  if not ok then
    if t.status = 'new' and target in ('assigned','in_progress','waiting_parts','resolved') then raise exception 'needs assignee'; end if;
    raise exception 'bad transition';
  end if;
  if target in ('assigned','in_progress','waiting_parts','resolved') and not has_tech then raise exception 'needs assignee'; end if;

  -- 2) is this person the one who does this step?
  ok := false;
  if r in ('admin','maintenance_manager') then ok := true;
  elsif r = 'technician' and t.assigned_to = auth.uid() then
    ok := t.status in ('assigned','in_progress','waiting_parts') and target in ('in_progress','waiting_parts','resolved');
  elsif r = 'supervisor' then
    ok := (t.status = 'resolved' and target in ('closed','in_progress')) or (t.status = 'closed' and target = 'in_progress');
  end if;
  if not ok then raise exception 'not allowed'; end if;

  -- 3) steps that must say why
  if note is null and (target in ('waiting_parts','cancelled') or (t.status in ('resolved','closed') and target = 'in_progress')) then
    raise exception 'note required';
  end if;

  update public.tickets set
    status = target,
    hold_reason = case when target = 'waiting_parts' then note end,
    resolved_at = case when target in ('resolved','closed') then coalesce(resolved_at, now())
                       when target in ('in_progress','assigned','waiting_parts','new') then null else resolved_at end,
    closed_at = case when target in ('closed','cancelled') then now() else null end
  where id = p_ticket_id;

  if target in ('resolved','closed','cancelled') then
    update public.branch_downtimes set ended_at = now() where ticket_id = p_ticket_id and ended_at is null;
  end if;

  insert into public.ticket_events (ticket_id, kind, from_value, to_value, body, actor)
  values (p_ticket_id, 'status', t.status, target, note, auth.uid());
end $$;

-- ---------- list view: both languages + who is waiting on whom ----------
drop view if exists public.v_tickets;
create view public.v_tickets with (security_invoker = true) as
select t.*,
       b.name_ar as branch_ar, b.name_en as branch_en, b.city_id,
       c.name_ar as category_ar, c.name_en as category_en,
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
grant select on public.v_tickets to authenticated;
