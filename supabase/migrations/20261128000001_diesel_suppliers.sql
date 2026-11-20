-- Diesel suppliers with the fixed price per litre agreed with them. A delivery whose
-- invoice shows only litres is costed at its supplier's price.
create table public.diesel_suppliers (
  id              bigint generated always as identity primary key,
  name            text not null unique check (length(trim(name)) > 0),
  price_per_liter numeric check (price_per_liter > 0),
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_diesel_suppliers_updated before update on public.diesel_suppliers for each row execute function public.set_updated_at();
create trigger trg_audit_diesel_suppliers after insert or update or delete on public.diesel_suppliers for each row execute function public.audit_trigger();
alter table public.diesel_suppliers enable row level security;
create policy diesel_suppliers_read on public.diesel_suppliers for select to authenticated using (public.is_active_user());
create policy diesel_suppliers_admin on public.diesel_suppliers for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.diesel_suppliers from anon;

alter table public.diesel_refuels add column if not exists supplier_id bigint references public.diesel_suppliers(id) on delete set null;
-- suppliers already typed on deliveries become the list (prices to be filled in)
insert into public.diesel_suppliers (name) select distinct trim(supplier) from public.diesel_refuels where supplier is not null and trim(supplier) <> '' and supplier not ilike 'TEST%' on conflict do nothing;
update public.diesel_refuels r set supplier_id = s.id from public.diesel_suppliers s where trim(r.supplier) = s.name;

-- a delivery is linked to the supplier whose name it carries
create or replace function public.diesel_refuel_link_supplier() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.supplier_id := (select id from public.diesel_suppliers where name = trim(coalesce(new.supplier, '')) limit 1);
  return new;
end $$;
revoke execute on function public.diesel_refuel_link_supplier() from public, anon, authenticated;
drop trigger if exists trg_diesel_refuel_supplier on public.diesel_refuels;
create trigger trg_diesel_refuel_supplier before insert or update of supplier on public.diesel_refuels
  for each row execute function public.diesel_refuel_link_supplier();
