-- =====================================================================
-- Equipment codes for stickers: <branch>-<type>-<number>, e.g. AQQ-WM-03.
-- Generated on insert, editable, unique. A machine keeps its code when it
-- moves branch (the sticker is on the machine).
-- =====================================================================

alter table public.branches add column if not exists code text;
update public.branches b set code = v.code from (values
  ('Ishbiliya','ISH'),('Al Hamra','HAM'),('Al Rimal 2','RM2'),('Al Arid','ARD'),('Al Aqiq','AQQ'),('Al Naseem','NSM'),
  ('Al Yarmouk','YRM'),('Al Rimal 1','RM1'),('Al Wurood','WRD'),('Al Izdihar','IZD'),('Al Khaleej','KHL'),('Al Wadi','WAD'),
  ('Al Kharj','KHJ'),('Al Narjis','NRJ'),('Al Marwa','MRW'),('Al Rawdah','RWD'),('Al Hamdaniya','HMD'),('Al Rakkah','RKH'),
  ('Zuhor','ZHR'),('91 Branch','B91'),('Academy','ACD')) v(name, code)
where b.name_en = v.name and b.code is null;
alter table public.branches add constraint branches_code_key unique (code);
alter table public.branches add constraint branches_code_format check (code is null or code ~ '^[A-Z0-9]{2,5}$');

alter table public.ticket_categories add column if not exists code text;
update public.ticket_categories c set code = v.code from (values
  ('AC','AC'),('Washing Machine','WM'),('Pressing Machine','PM'),('Dryer','DR'),('Dry-Clean','DC'),('Boiler','BL'),
  ('Facility','FC'),('Electrical & Lighting','EL'),('Water & Drainage','WD'),('Cameras & IT','IT'),('General','GN'),('Racks & Fixtures','RF')) v(name, code)
where c.name_en = v.name and c.code is null;
alter table public.ticket_categories add constraint ticket_categories_code_key unique (code);

alter table public.equipment add column if not exists code text;
alter table public.equipment add constraint equipment_code_key unique (code);

create or replace function public.next_equipment_code(p_branch bigint, p_category bigint) returns text
language plpgsql stable security definer set search_path = '' as $$
declare pre text; n int;
begin
  pre := coalesce((select code from public.branches where id = p_branch), 'B' || p_branch) || '-'
      || coalesce((select code from public.ticket_categories where id = p_category), 'EQ') || '-';
  select coalesce(max(substring(code from length(pre) + 1)::int), 0) + 1 into n
    from public.equipment where code like pre || '%' and substring(code from length(pre) + 1) ~ '^[0-9]+$';
  return pre || lpad(n::text, 2, '0');
end $$;
revoke execute on function public.next_equipment_code(bigint, bigint) from public, anon;
grant execute on function public.next_equipment_code(bigint, bigint) to authenticated;

create or replace function public.equipment_set_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.code := upper(nullif(trim(new.code), ''));
  if new.code is null then
    if tg_op = 'UPDATE' then new.code := old.code;
    else new.code := public.next_equipment_code(new.branch_id, new.category_id);
    end if;
  end if;
  return new;
end $$;
create trigger trg_equipment_code before insert or update on public.equipment
  for each row execute function public.equipment_set_code();

-- codes for what is already recorded, in the order it was entered (Washing Machine 1 → …-WM-01)
do $$
declare r record;
begin
  for r in select id, branch_id, category_id from public.equipment where code is null order by id loop
    update public.equipment set code = public.next_equipment_code(r.branch_id, r.category_id) where id = r.id;
  end loop;
end $$;
alter table public.equipment alter column code set not null;

-- ticket list view: add the machine's code
drop view if exists public.v_tickets;
create view public.v_tickets with (security_invoker = true) as
select t.*,
       b.name_ar as branch_ar, b.name_en as branch_en, b.city_id,
       c.name_ar as category_ar, c.name_en as category_en,
       e.name as equipment_name, e.code as equipment_code,
       coalesce(pa.full_name, t.assignee_name) as assignee_display,
       coalesce(pa.phone, t.assignee_phone) as assignee_contact,
       coalesce(pr.full_name, t.reporter_name) as reporter_display,
       (t.status not in ('resolved','closed','cancelled') and t.due_at < now()) as overdue
from public.tickets t
join public.branches b on b.id = t.branch_id
left join public.ticket_categories c on c.id = t.category_id
left join public.equipment e on e.id = t.equipment_id
left join public.profiles pa on pa.id = t.assigned_to
left join public.profiles pr on pr.id = t.reported_by;
revoke all on public.v_tickets from anon;
grant select on public.v_tickets to authenticated;
