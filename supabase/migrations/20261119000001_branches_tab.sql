-- =====================================================================
-- Branches tab: branch files (licences, contracts…), equipment register
-- linked to maintenance tickets, materials catalogue with min / max,
-- and editable texts (how to order materials from Odoo).
-- =====================================================================

-- ---------- branch files: a record per document, the scan is optional ----------
alter table public.branch_files drop constraint if exists branch_files_kind_check;
alter table public.branch_files add constraint branch_files_kind_check check (kind in
  ('baladiya','civil_defense','lease','commercial_reg','electricity','water','snag_list','technical_report','other'));
alter table public.branch_files
  alter column file_path drop not null,
  add column if not exists number      text,
  add column if not exists expiry_date date,
  add column if not exists notes       text,
  add column if not exists mime_type   text,
  add column if not exists updated_at  timestamptz not null default now();
create trigger trg_branch_files_updated before update on public.branch_files
  for each row execute function public.set_updated_at();
create trigger trg_audit_branch_files after insert or update or delete on public.branch_files
  for each row execute function public.audit_trigger();

-- ---------- equipment ----------
create table public.equipment (
  id             bigint generated always as identity primary key,
  branch_id      bigint not null references public.branches(id),
  category_id    bigint references public.ticket_categories(id),
  name           text not null check (length(trim(name)) > 0),
  brand          text,
  model          text,
  serial_no      text,
  capacity       text,
  installed_on   date,
  warranty_until date,
  status         text not null default 'working' check (status in ('working','needs_repair','stopped','retired')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.equipment (branch_id);
create trigger trg_equipment_updated before update on public.equipment
  for each row execute function public.set_updated_at();
create trigger trg_audit_equipment after insert or update or delete on public.equipment
  for each row execute function public.audit_trigger();
alter table public.equipment enable row level security;
create policy equipment_read on public.equipment for select to authenticated
  using (public.can_see_branch(branch_id) or public.app_role() in ('technician','maintenance_manager'));
create policy equipment_write on public.equipment for all to authenticated
  using (public.app_role() in ('admin','maintenance_manager')) with check (public.app_role() in ('admin','maintenance_manager'));
revoke all on public.equipment from anon;

alter table public.tickets add column if not exists equipment_id bigint references public.equipment(id) on delete set null;
create index if not exists tickets_equipment on public.tickets (equipment_id);

-- create_ticket gains the machine (optional); it must belong to the same branch
drop function if exists public.create_ticket(bigint,bigint,text,text,text,boolean);
create function public.create_ticket(
  p_branch_id bigint, p_category_id bigint, p_priority text, p_title text,
  p_description text default null, p_stops_branch boolean default false, p_equipment_id bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare tid bigint; hrs int; cat bigint := p_category_id;
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor','maintenance_manager') then raise exception 'not allowed'; end if;
  if not public.can_see_branch(p_branch_id) and public.app_role() <> 'maintenance_manager' then raise exception 'not allowed for this branch'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'العنوان مطلوب'; end if;
  if p_equipment_id is not null then
    select coalesce(cat, e.category_id) into cat from public.equipment e where e.id = p_equipment_id and e.branch_id = p_branch_id;
    if not found then raise exception 'equipment not in branch'; end if;
  end if;
  select resolve_hours into hrs from public.sla_policies where priority = p_priority;
  if hrs is null then raise exception 'bad priority'; end if;

  insert into public.tickets (branch_id, category_id, equipment_id, priority, title, description, stops_branch, reported_by, due_at)
  values (p_branch_id, cat, p_equipment_id, p_priority, trim(p_title), nullif(trim(p_description), ''), coalesce(p_stops_branch, false),
          auth.uid(), now() + make_interval(hours => hrs))
  returning id into tid;
  insert into public.ticket_events (ticket_id, kind, actor) values (tid, 'created', auth.uid());
  if p_stops_branch then
    insert into public.branch_downtimes (branch_id, started_at, reason, ticket_id, created_by)
    values (p_branch_id, now(), trim(p_title), tid, auth.uid());
  end if;
  return tid;
end $$;
revoke execute on function public.create_ticket(bigint,bigint,text,text,text,boolean,bigint) from public, anon;
grant execute on function public.create_ticket(bigint,bigint,text,text,text,boolean,bigint) to authenticated;

-- ticket list view: add the machine
drop view if exists public.v_tickets;
create view public.v_tickets with (security_invoker = true) as
select t.*,
       b.name_ar as branch_ar, b.name_en as branch_en, b.city_id,
       c.name_ar as category_ar, c.name_en as category_en,
       e.name as equipment_name,
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

-- ---------- materials catalogue (orders themselves are placed in Odoo) ----------
create table public.materials (
  id          bigint generated always as identity primary key,
  name        text not null check (length(trim(name)) > 0),
  category    text not null default 'other' check (category in ('chemicals','packaging','consumables','tools','other')),
  unit        text,
  odoo_ref    text,
  min_qty     numeric check (min_qty >= 0),
  max_qty     numeric check (max_qty >= 0),
  photo_path  text,
  notes       text,
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (min_qty is null or max_qty is null or max_qty >= min_qty)
);
create trigger trg_materials_updated before update on public.materials
  for each row execute function public.set_updated_at();
create trigger trg_audit_materials after insert or update or delete on public.materials
  for each row execute function public.audit_trigger();
alter table public.materials enable row level security;
create policy materials_read on public.materials for select to authenticated using (public.is_active_user());
create policy materials_admin on public.materials for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.materials from anon;

-- ---------- editable texts (e.g. how to order materials from Odoo) ----------
create table public.app_texts (
  key        text primary key,
  body       text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
alter table public.app_texts enable row level security;
create policy app_texts_read on public.app_texts for select to authenticated using (public.is_active_user());
create policy app_texts_admin on public.app_texts for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.app_texts from anon;

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branch-files', 'branch-files', false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
create policy branch_files_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'branch-files' and public.can_see_branch(public.ticket_id_from_path(name)));
create policy branch_files_obj_write on storage.objects for insert to authenticated
  with check (bucket_id = 'branch-files' and public.is_admin());
create policy branch_files_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branch-files' and public.is_admin());

-- product photos are not sensitive: public read, admin write
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('material-photos', 'material-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy material_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'material-photos' and public.is_admin());
create policy material_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'material-photos' and public.is_admin());

-- deleting a photo through the API needs read access to the object
create policy material_photos_read on storage.objects for select to authenticated using (bucket_id = 'material-photos');
