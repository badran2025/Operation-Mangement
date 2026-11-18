-- =====================================================================
-- Diesel: tanks, dipstick readings (cm) turned into litres, refuels
-- checked against what was ordered, and level checks for stock and use.
--
--  * box tank            litres = cm × length × width / 1000
--  * vertical cylinder   litres = cm × π r² / 1000
--  * horizontal cylinder litres from the circle-segment formula, or from a
--                        calibration table (cm → litres) when one is entered
--  A calibration table, when present, always wins (it is what was measured).
-- =====================================================================

create table public.diesel_tanks (
  id           bigint generated always as identity primary key,
  branch_id    bigint not null references public.branches(id),
  label        text not null default 'Tank 1',
  shape        text not null default 'box' check (shape in ('box','vertical_cylinder','horizontal_cylinder')),
  length_cm    numeric check (length_cm > 0),
  width_cm     numeric check (width_cm > 0),
  height_cm    numeric check (height_cm > 0),
  diameter_cm  numeric check (diameter_cm > 0),
  confirmed    boolean not null default false,
  notes        text,
  active       boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.diesel_tanks (branch_id);
create trigger trg_diesel_tanks_updated before update on public.diesel_tanks for each row execute function public.set_updated_at();
create trigger trg_audit_diesel_tanks after insert or update or delete on public.diesel_tanks for each row execute function public.audit_trigger();

create table public.diesel_tank_points (
  tank_id   bigint not null references public.diesel_tanks(id) on delete cascade,
  level_cm  numeric not null check (level_cm >= 0),
  liters    numeric not null check (liters >= 0),
  primary key (tank_id, level_cm)
);

-- litres in a tank at a dipstick reading
create or replace function public.tank_liters(p_tank bigint, p_cm numeric) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare t public.diesel_tanks; lo_cm numeric; lo_l numeric; hi_cm numeric; hi_l numeric; r numeric; h numeric; v numeric;
begin
  if p_cm is null then return null; end if;
  select * into t from public.diesel_tanks where id = p_tank;
  if not found then return null; end if;

  if exists (select 1 from public.diesel_tank_points where tank_id = p_tank) then
    select level_cm, liters into lo_cm, lo_l from public.diesel_tank_points where tank_id = p_tank and level_cm <= p_cm order by level_cm desc limit 1;
    select level_cm, liters into hi_cm, hi_l from public.diesel_tank_points where tank_id = p_tank and level_cm >= p_cm order by level_cm asc limit 1;
    lo_cm := coalesce(lo_cm, 0); lo_l := coalesce(lo_l, 0);
    if hi_cm is null then return round(lo_l, 1); end if;          -- above the table: the highest measured point
    if hi_cm = lo_cm then return round(hi_l, 1); end if;
    return round(lo_l + (hi_l - lo_l) * (p_cm - lo_cm) / (hi_cm - lo_cm), 1);
  end if;

  if t.shape = 'box' then
    h := least(greatest(p_cm, 0), coalesce(t.height_cm, p_cm));
    v := h * t.length_cm * t.width_cm / 1000;
  elsif t.shape = 'vertical_cylinder' then
    h := least(greatest(p_cm, 0), coalesce(t.height_cm, p_cm));
    v := h * pi() * power(t.diameter_cm / 2, 2) / 1000;
  else
    r := t.diameter_cm / 2;
    h := least(greatest(p_cm, 0), t.diameter_cm);
    v := t.length_cm * (r * r * acos((r - h) / r) - (r - h) * sqrt(greatest(2 * r * h - h * h, 0))) / 1000;
  end if;
  return round(v, 1);
end $$;

create or replace function public.tank_full_cm(t public.diesel_tanks) returns numeric
language sql immutable set search_path = '' as $$
  select case when t.shape = 'horizontal_cylinder' then t.diameter_cm else t.height_cm end
$$;

-- ---------- refuels and readings ----------
comment on column public.diesel_refuels.liters is 'litres ordered / on the invoice';
alter table public.diesel_refuels
  add column if not exists received_liters numeric,
  add column if not exists supplier        text,
  add column if not exists price_per_liter numeric check (price_per_liter >= 0),
  add column if not exists invoice_no      text;
alter table public.diesel_refuel_files add column if not exists mime_type text;

create table public.diesel_dips (
  id         bigint generated always as identity primary key,
  tank_id    bigint not null references public.diesel_tanks(id),
  branch_id  bigint not null references public.branches(id),
  read_at    timestamptz not null default now(),
  level_cm   numeric not null check (level_cm >= 0),
  liters     numeric not null,
  kind       text not null check (kind in ('check','before','after')),
  refuel_id  bigint references public.diesel_refuels(id) on delete cascade,
  notes      text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.diesel_dips (branch_id, read_at desc);
create index on public.diesel_dips (tank_id, read_at desc);

-- ---------- access ----------
alter table public.diesel_tanks enable row level security;
alter table public.diesel_tank_points enable row level security;
alter table public.diesel_dips enable row level security;
create policy dtank_read on public.diesel_tanks for select to authenticated using (public.can_see_branch(branch_id));
create policy dtank_admin on public.diesel_tanks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy dpoint_read on public.diesel_tank_points for select to authenticated
  using (exists (select 1 from public.diesel_tanks t where t.id = tank_id and public.can_see_branch(t.branch_id)));
create policy dpoint_admin on public.diesel_tank_points for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ddip_read on public.diesel_dips for select to authenticated using (public.can_see_branch(branch_id));
create policy ddip_admin on public.diesel_dips for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.diesel_tanks, public.diesel_tank_points, public.diesel_dips from anon;

-- readings come in through these two functions (supervisor of the branch or admin)
create or replace function public.record_diesel_refuel(
  p_branch_id bigint, p_date date, p_ordered numeric, p_dips jsonb,
  p_supplier text default null, p_price numeric default null, p_invoice text default null, p_notes text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare rid bigint; d jsonb; t public.diesel_tanks; b numeric; a numeric; bl numeric; al numeric; got numeric := 0; n int := 0;
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor') or not public.can_see_branch(p_branch_id) then raise exception 'not allowed'; end if;
  if p_date is null or p_date > public.riyadh_today() then raise exception 'diesel bad date'; end if;
  if p_ordered is null or p_ordered <= 0 then raise exception 'diesel ordered required'; end if;

  insert into public.diesel_refuels (branch_id, refuel_date, liters, supplier, price_per_liter, invoice_no, notes, created_by)
  values (p_branch_id, p_date, p_ordered, nullif(trim(p_supplier), ''), p_price, nullif(trim(p_invoice), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into rid;

  for d in select * from jsonb_array_elements(coalesce(p_dips, '[]'::jsonb)) loop
    select * into t from public.diesel_tanks where id = (d->>'tank_id')::bigint and branch_id = p_branch_id and active;
    if not found then raise exception 'diesel tank not in branch'; end if;
    b := (d->>'before_cm')::numeric; a := (d->>'after_cm')::numeric;
    if b is null or a is null or b < 0 or a < 0 or (public.tank_full_cm(t) is not null and greatest(a, b) > public.tank_full_cm(t)) then raise exception 'diesel bad reading'; end if;
    if a < b then raise exception 'diesel after below before'; end if;
    bl := public.tank_liters(t.id, b); al := public.tank_liters(t.id, a);
    insert into public.diesel_dips (tank_id, branch_id, read_at, level_cm, liters, kind, refuel_id, created_by)
    values (t.id, p_branch_id, now(), b, bl, 'before', rid, auth.uid()),
           (t.id, p_branch_id, now(), a, al, 'after', rid, auth.uid());   -- same moment; the later id is the newer reading
    got := got + (al - bl); n := n + 1;
  end loop;
  if n = 0 then raise exception 'diesel readings required'; end if;

  update public.diesel_refuels set received_liters = round(got, 1), shortage_liters = greatest(round(p_ordered - got, 1), 0) where id = rid;
  return rid;
end $$;

create or replace function public.record_diesel_check(p_branch_id bigint, p_dips jsonb, p_notes text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare d jsonb; t public.diesel_tanks; c numeric; n int := 0;
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor') or not public.can_see_branch(p_branch_id) then raise exception 'not allowed'; end if;
  for d in select * from jsonb_array_elements(coalesce(p_dips, '[]'::jsonb)) loop
    select * into t from public.diesel_tanks where id = (d->>'tank_id')::bigint and branch_id = p_branch_id and active;
    if not found then raise exception 'diesel tank not in branch'; end if;
    c := (d->>'cm')::numeric;
    if c is null or c < 0 or (public.tank_full_cm(t) is not null and c > public.tank_full_cm(t)) then raise exception 'diesel bad reading'; end if;
    insert into public.diesel_dips (tank_id, branch_id, level_cm, liters, kind, notes, created_by)
    values (t.id, p_branch_id, c, public.tank_liters(t.id, c), 'check', nullif(trim(p_notes), ''), auth.uid());
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'diesel readings required'; end if;
  return n;
end $$;

revoke execute on function public.tank_liters(bigint, numeric) from public, anon;
revoke execute on function public.record_diesel_refuel(bigint, date, numeric, jsonb, text, numeric, text, text) from public, anon;
revoke execute on function public.record_diesel_check(bigint, jsonb, text) from public, anon;
grant execute on function public.tank_liters(bigint, numeric) to authenticated;
grant execute on function public.record_diesel_refuel(bigint, date, numeric, jsonb, text, numeric, text, text) to authenticated;
grant execute on function public.record_diesel_check(bigint, jsonb, text) to authenticated;

-- tank list with capacity, litres per cm (straight tanks) and the latest reading
create or replace view public.v_diesel_tanks with (security_invoker = true) as
select t.*,
       public.tank_liters(t.id, public.tank_full_cm(t)) as capacity_l,
       case when t.shape = 'box' then t.length_cm * t.width_cm / 1000
            when t.shape = 'vertical_cylinder' then round((pi() * power(t.diameter_cm / 2, 2) / 1000)::numeric, 2) end as liters_per_cm,
       (select count(*) from public.diesel_tank_points p where p.tank_id = t.id) as calibration_points,
       last.level_cm as last_cm, last.liters as last_liters, last.read_at as last_read_at
from public.diesel_tanks t
left join lateral (select d.level_cm, d.liters, d.read_at from public.diesel_dips d where d.tank_id = t.id order by d.read_at desc, d.id desc limit 1) last on true;
revoke all on public.v_diesel_tanks from anon;
grant select on public.v_diesel_tanks to authenticated;

-- ---------- private bucket for invoices / tank photos (path = <branch_id>/<file>) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diesel-files', 'diesel-files', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
create policy diesel_files_read on storage.objects for select to authenticated
  using (bucket_id = 'diesel-files' and public.can_see_branch(public.ticket_id_from_path(name)));
create policy diesel_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'diesel-files' and public.app_role() in ('admin','supervisor') and public.can_see_branch(public.ticket_id_from_path(name)));
create policy diesel_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'diesel-files' and public.is_admin());

-- ---------- the tanks already measured (all box / rectangular, confirmed) ----------
insert into public.diesel_tanks (branch_id, label, shape, length_cm, width_cm, height_cm, confirmed, sort)
select b.id, v.label, 'box', v.l, v.w, v.h, true, v.s
from (values
  ('Al Rimal 1',  'Tank 1', 100, 100, 100, 0), ('Al Rimal 1', 'Tank 2', 100, 100, 100, 1),
  ('Al Yarmouk',  'Tank 1', 100, 200, 100, 0),
  ('Al Arid',     'Tank 1', 100, 100, 100, 0),
  ('Al Hamra',    'Tank 1', 100, 100, 100, 0),
  ('Al Izdihar',  'Tank 1', 160,  60, 100, 0),
  ('Al Wurood',   'Tank 1', 100, 100, 100, 0),
  ('Al Khaleej',  'Tank 1', 100, 200, 100, 0),
  ('Al Naseem',   'Tank 1', 100, 100, 100, 0),
  ('Al Kharj',    'Tank 1', 100, 100, 100, 0)) v(branch, label, l, w, h, s)
join public.branches b on b.name_en = v.branch
where not exists (select 1 from public.diesel_tanks x where x.branch_id = b.id);
