-- Materials: the catalogue holds the item (name, photo, unit, Odoo code);
-- each branch picks the items it uses, with its own min / max.
create table public.branch_materials (
  branch_id   bigint not null references public.branches(id) on delete cascade,
  material_id bigint not null references public.materials(id) on delete cascade,
  min_qty     numeric check (min_qty >= 0),
  max_qty     numeric check (max_qty >= 0),
  notes       text,
  created_at  timestamptz not null default now(),
  primary key (branch_id, material_id),
  check (min_qty is null or max_qty is null or max_qty >= min_qty)
);
create trigger trg_audit_branch_materials after insert or update or delete on public.branch_materials
  for each row execute function public.audit_trigger();
alter table public.branch_materials enable row level security;
create policy bm_read on public.branch_materials for select to authenticated using (public.can_see_branch(branch_id));
create policy bm_admin on public.branch_materials for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.branch_materials from anon;

alter table public.materials drop column if exists min_qty, drop column if exists max_qty;

-- equipment: fixtures are counted (e.g. 70 laundry buckets); machines stay one row each
alter table public.equipment add column if not exists quantity int not null default 1 check (quantity > 0);

insert into public.ticket_categories (name_ar, name_en, sort)
select 'أرفف وتجهيزات', 'Racks & Fixtures', 12
where not exists (select 1 from public.ticket_categories where name_en = 'Racks & Fixtures');
