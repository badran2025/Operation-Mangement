-- =====================================================================
-- A machine's status follows its maintenance tickets:
--   ticket opened on a working machine      -> machine "needs repair"
--   ticket reopened                          -> machine "needs repair"
--   last open ticket closed / cancelled      -> machine "working" again
-- "Retired" machines are never touched. A machine marked "stopped" by hand
-- stays stopped while it has open tickets.
-- =====================================================================
create or replace function public.equipment_follow_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
declare open_left int;
begin
  if new.equipment_id is null then return new; end if;

  if tg_op = 'INSERT' or (old.status in ('resolved','closed','cancelled') and new.status in ('new','assigned','in_progress','waiting_parts')) then
    update public.equipment set status = 'needs_repair' where id = new.equipment_id and status = 'working';
  elsif new.status in ('closed','cancelled') and old.status is distinct from new.status then
    select count(*) into open_left from public.tickets
     where equipment_id = new.equipment_id and id <> new.id and status not in ('closed','cancelled');
    if open_left = 0 then
      update public.equipment set status = 'working' where id = new.equipment_id and status in ('needs_repair','stopped');
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.equipment_follow_ticket() from public, anon, authenticated;

drop trigger if exists trg_ticket_equipment on public.tickets;
create trigger trg_ticket_equipment after insert or update of status on public.tickets
  for each row execute function public.equipment_follow_ticket();
