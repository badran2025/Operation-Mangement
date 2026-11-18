-- =====================================================================
-- Two ways of measuring a tank:
--   liters : litres are known (square / rectangular tank from its dimensions,
--            or any tank with a calibration table) → deliveries are checked
--            against the invoice.
--   cm     : litres not known yet (cylindrical tank being calibrated) → only
--            centimetres are recorded; each delivery (cm before → cm after,
--            invoice litres) is evidence used to build the calibration table.
-- A cm tank becomes litre-measured as soon as it has a calibration table.
-- =====================================================================
alter table public.diesel_tanks add column if not exists measure_by text not null default 'liters'
  check (measure_by in ('liters','cm'));
update public.diesel_tanks set measure_by = 'cm' where shape <> 'box' and not exists (select 1 from public.diesel_tank_points p where p.tank_id = diesel_tanks.id);
alter table public.diesel_dips alter column liters drop not null;

-- are litres known for this tank?
create or replace function public.tank_liters_known(p_tank bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.diesel_tank_points where tank_id = p_tank)
      or exists (select 1 from public.diesel_tanks where id = p_tank and measure_by = 'liters')
$$;
revoke execute on function public.tank_liters_known(bigint) from public, anon;
grant execute on function public.tank_liters_known(bigint) to authenticated;

create or replace function public.record_diesel_refuel(
  p_branch_id bigint, p_date date, p_invoice_liters numeric, p_dips jsonb,
  p_supplier text default null, p_total numeric default null, p_invoice text default null, p_notes text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare rid bigint; d jsonb; t public.diesel_tanks; b numeric; a numeric; bl numeric; al numeric;
        sum_b numeric := 0; sum_a numeric := 0; n int := 0; all_known boolean := true;
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor') or not public.can_see_branch(p_branch_id) then raise exception 'not allowed'; end if;
  if p_date is null or p_date > public.riyadh_today() then raise exception 'diesel bad date'; end if;
  if p_invoice_liters is null or p_invoice_liters <= 0 then raise exception 'diesel ordered required'; end if;
  if p_total is not null and p_total < 0 then raise exception 'diesel bad total'; end if;

  insert into public.diesel_refuels (branch_id, refuel_date, liters, supplier, total_amount, price_per_liter, invoice_no, notes, created_by)
  values (p_branch_id, p_date, p_invoice_liters, nullif(trim(p_supplier), ''), p_total,
          case when p_total is not null then round(p_total / p_invoice_liters, 3) end,
          nullif(trim(p_invoice), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into rid;

  for d in select * from jsonb_array_elements(coalesce(p_dips, '[]'::jsonb)) loop
    select * into t from public.diesel_tanks where id = (d->>'tank_id')::bigint and branch_id = p_branch_id and active;
    if not found then raise exception 'diesel tank not in branch'; end if;
    b := (d->>'before_cm')::numeric; a := (d->>'after_cm')::numeric;
    if b is null or a is null or b < 0 or a < 0 or (public.tank_full_cm(t) is not null and greatest(a, b) > public.tank_full_cm(t)) then raise exception 'diesel bad reading'; end if;
    if a < b then raise exception 'diesel after below before'; end if;
    if public.tank_liters_known(t.id) then
      bl := public.tank_liters(t.id, b); al := public.tank_liters(t.id, a);
      sum_b := sum_b + bl; sum_a := sum_a + al;
    else
      bl := null; al := null; all_known := false;
    end if;
    insert into public.diesel_dips (tank_id, branch_id, read_at, level_cm, liters, kind, refuel_id, created_by)
    values (t.id, p_branch_id, now(), b, bl, 'before', rid, auth.uid()),
           (t.id, p_branch_id, now(), a, al, 'after', rid, auth.uid());
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'diesel readings required'; end if;

  if all_known then
    update public.diesel_refuels set
      before_liters = round(sum_b, 1), after_liters = round(sum_a, 1), received_liters = round(sum_a - sum_b, 1),
      shortage_liters = greatest(round(p_invoice_liters - (sum_a - sum_b), 1), 0)
    where id = rid;
  end if;
  return rid;
end $$;
revoke execute on function public.record_diesel_refuel(bigint, date, numeric, jsonb, text, numeric, text, text) from public, anon;
grant execute on function public.record_diesel_refuel(bigint, date, numeric, jsonb, text, numeric, text, text) to authenticated;

-- tanks view with how each tank is measured (a new view, so nothing is dropped)
create view public.v_diesel_tank_info with (security_invoker = true) as
select t.*,
       public.tank_liters_known(t.id) as liters_known,
       public.tank_liters(t.id, public.tank_full_cm(t)) as capacity_l,
       case when t.shape = 'box' then t.length_cm * t.width_cm / 1000
            when t.shape = 'vertical_cylinder' then round((pi() * power(t.diameter_cm / 2, 2) / 1000)::numeric, 2) end as liters_per_cm,
       (select count(*) from public.diesel_tank_points p where p.tank_id = t.id) as calibration_points,
       last.level_cm as last_cm, last.liters as last_liters, last.read_at as last_read_at
from public.diesel_tanks t
left join lateral (select d.level_cm, d.liters, d.read_at from public.diesel_dips d where d.tank_id = t.id order by d.read_at desc, d.id desc limit 1) last on true;
revoke all on public.v_diesel_tank_info from anon;
grant select on public.v_diesel_tank_info to authenticated;
