-- =====================================================================
-- Branch downtime from tickets marked "this problem stopped the branch".
--   * starts when the ticket is opened (already in create_ticket)
--   * ends when the ticket is fixed / closed / cancelled (already in set_ticket_status)
--   * starts again if the ticket is reopened ("still broken")
--   * a manager can mark / unmark an existing ticket as stopping the branch
-- v_branch_downtime gives, per branch: the stoppage going on now (since when,
-- why, which ticket) and the time stopped this month and in the last 30 days.
-- Overlapping stoppages are counted once.
-- =====================================================================

create or replace function public.downtime_follow_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stops_branch
     and old.status in ('resolved','closed','cancelled') and new.status in ('new','assigned','in_progress','waiting_parts')
     and not exists (select 1 from public.branch_downtimes where ticket_id = new.id and ended_at is null) then
    insert into public.branch_downtimes (branch_id, started_at, reason, ticket_id, created_by)
    values (new.branch_id, now(), new.title, new.id, auth.uid());
  end if;
  return new;
end $$;
revoke execute on function public.downtime_follow_ticket() from public, anon, authenticated;
drop trigger if exists trg_ticket_downtime on public.tickets;
create trigger trg_ticket_downtime after update of status on public.tickets
  for each row execute function public.downtime_follow_ticket();

alter table public.ticket_events drop constraint if exists ticket_events_kind_check;
alter table public.ticket_events add constraint ticket_events_kind_check check (kind in
  ('created','comment','status','assign','priority','reminder','escalation','parts','stops_branch'));

create or replace function public.set_ticket_stops_branch(p_ticket_id bigint, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tickets;
begin
  if coalesce(public.app_role(), '') not in ('admin','maintenance_manager') then raise exception 'not allowed'; end if;
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'not found'; end if;
  if t.stops_branch = p_on then return; end if;
  update public.tickets set stops_branch = p_on where id = p_ticket_id;
  if p_on then
    if t.status not in ('resolved','closed','cancelled') then
      insert into public.branch_downtimes (branch_id, started_at, reason, ticket_id, created_by)
      values (t.branch_id, now(), t.title, t.id, auth.uid());
    end if;
  else
    -- marked by mistake: the branch was never stopped by this ticket
    delete from public.branch_downtimes where ticket_id = p_ticket_id;
  end if;
  insert into public.ticket_events (ticket_id, kind, to_value, actor)
  values (p_ticket_id, 'stops_branch', case when p_on then 'on' else 'off' end, auth.uid());
end $$;
revoke execute on function public.set_ticket_stops_branch(bigint, boolean) from public, anon;
grant execute on function public.set_ticket_stops_branch(bigint, boolean) to authenticated;

create or replace view public.v_branch_downtime with (security_invoker = true) as
with w as (
  select now() as now_,
         (date_trunc('month', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh') as month_start,
         now() - interval '30 days' as d30_start
), per as (
  select d.branch_id, range_agg(tstzrange(d.started_at, coalesce(d.ended_at, w.now_))) as spans
  from public.branch_downtimes d, w
  where d.started_at < w.now_
  group by d.branch_id
)
select b.id as branch_id,
       cur.started_at as open_since, cur.ticket_id as open_ticket_id,
       coalesce(tk.title, cur.reason) as open_reason,
       coalesce((select sum(extract(epoch from upper(r) - lower(r))) from unnest(per.spans * tstzmultirange(tstzrange(w.month_start, w.now_))) r), 0)::bigint / 60 as minutes_month,
       coalesce((select sum(extract(epoch from upper(r) - lower(r))) from unnest(per.spans * tstzmultirange(tstzrange(w.d30_start, w.now_))) r), 0)::bigint / 60 as minutes_30d,
       (select count(*) from public.branch_downtimes d where d.branch_id = b.id and coalesce(d.ended_at, w.now_) > w.d30_start) as stops_30d
from public.branches b
cross join w
left join per on per.branch_id = b.id
left join lateral (
  select d.started_at, d.ticket_id, d.reason from public.branch_downtimes d
  where d.branch_id = b.id and d.ended_at is null order by d.started_at limit 1
) cur on true
left join public.tickets tk on tk.id = cur.ticket_id;
revoke all on public.v_branch_downtime from anon;
grant select on public.v_branch_downtime to authenticated;
