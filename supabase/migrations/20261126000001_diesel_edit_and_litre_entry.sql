-- =====================================================================
-- 1) A tank's readings can be entered in centimetres (dipstick) or in litres
--    (a gauge that shows litres). Each tank has its usual unit; the form can switch.
--    Whatever is entered, both the centimetres and the litres are stored.
-- 2) A delivery can be edited after it is recorded.
-- =====================================================================
alter table public.diesel_tanks add column if not exists entry_unit text not null default 'cm' check (entry_unit in ('cm','liters'));
update public.diesel_tanks set entry_unit = 'liters' where shape = 'box';
alter table public.diesel_dips add column if not exists entered_as text not null default 'cm' check (entered_as in ('cm','liters'));

-- the dipstick height that holds a number of litres (the tank's own formula or table, searched by halves)
create or replace function public.tank_cm_for_liters(p_tank bigint, p_liters numeric) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare t public.diesel_tanks; lo numeric := 0; hi numeric; mid numeric; i int;
begin
  if p_liters is null then return null; end if;
  select * into t from public.diesel_tanks where id = p_tank;
  hi := public.tank_full_cm(t);
  if hi is null then return null; end if;
  if p_liters > public.tank_liters(p_tank, hi) + 0.05 then return null; end if;  -- more than the tank holds
  for i in 1..40 loop
    mid := (lo + hi) / 2;
    if public.tank_liters(p_tank, mid) < p_liters then lo := mid; else hi := mid; end if;
  end loop;
  return round((lo + hi) / 2, 1);
end $$;
revoke execute on function public.tank_cm_for_liters(bigint, numeric) from public, anon;
grant execute on function public.tank_cm_for_liters(bigint, numeric) to authenticated;

-- one tank reading from {cm} or {liters}: returns (cm, litres or null, entered_as); raises on a bad value
create or replace function public.diesel_reading(t public.diesel_tanks, p_cm numeric, p_liters numeric, out cm numeric, out liters numeric, out entered text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_liters is not null then
    if p_liters < 0 or not public.tank_liters_known(t.id) then raise exception 'diesel bad reading'; end if;
    cm := public.tank_cm_for_liters(t.id, p_liters);
    if cm is null then raise exception 'diesel bad reading'; end if;
    liters := round(p_liters, 1); entered := 'liters';
  else
    if p_cm is null or p_cm < 0 or (public.tank_full_cm(t) is not null and p_cm > public.tank_full_cm(t)) then raise exception 'diesel bad reading'; end if;
    cm := p_cm; entered := 'cm';
    liters := case when public.tank_liters_known(t.id) then public.tank_liters(t.id, p_cm) end;
  end if;
end $$;
revoke execute on function public.diesel_reading(public.diesel_tanks, numeric, numeric) from public, anon, authenticated;

-- the readings of a delivery and its totals (shared by record and edit)
create or replace function public.diesel_refuel_readings(p_refuel bigint, p_branch_id bigint, p_invoice_liters numeric, p_dips jsonb, p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare d jsonb; t public.diesel_tanks; b record; a record; sum_b numeric := 0; sum_a numeric := 0; n int := 0; all_known boolean := true;
begin
  delete from public.diesel_dips where refuel_id = p_refuel;
  for d in select * from jsonb_array_elements(coalesce(p_dips, '[]'::jsonb)) loop
    select * into t from public.diesel_tanks where id = (d->>'tank_id')::bigint and branch_id = p_branch_id and active;
    if not found then raise exception 'diesel tank not in branch'; end if;
    select * into b from public.diesel_reading(t, (d->>'before_cm')::numeric, (d->>'before_l')::numeric);
    select * into a from public.diesel_reading(t, (d->>'after_cm')::numeric, (d->>'after_l')::numeric);
    if a.cm < b.cm then raise exception 'diesel after below before'; end if;
    if b.liters is null or a.liters is null then all_known := false; else sum_b := sum_b + b.liters; sum_a := sum_a + a.liters; end if;
    insert into public.diesel_dips (tank_id, branch_id, read_at, level_cm, liters, kind, refuel_id, entered_as, created_by)
    values (t.id, p_branch_id, p_at, b.cm, b.liters, 'before', p_refuel, b.entered, auth.uid()),
           (t.id, p_branch_id, p_at, a.cm, a.liters, 'after', p_refuel, a.entered, auth.uid());
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'diesel readings required'; end if;
  update public.diesel_refuels set
    before_liters = case when all_known then round(sum_b, 1) end, after_liters = case when all_known then round(sum_a, 1) end,
    received_liters = case when all_known then round(sum_a - sum_b, 1) end,
    shortage_liters = case when all_known then greatest(round(p_invoice_liters - (sum_a - sum_b), 1), 0) end
  where id = p_refuel;
end $$;
revoke execute on function public.diesel_refuel_readings(bigint, bigint, numeric, jsonb, timestamptz) from public, anon, authenticated;

create or replace function public.record_diesel_refuel(
  p_branch_id bigint, p_date date, p_invoice_liters numeric, p_dips jsonb,
  p_supplier text default null, p_total numeric default null, p_invoice text default null, p_notes text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare rid bigint;
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
  perform public.diesel_refuel_readings(rid, p_branch_id, p_invoice_liters, p_dips, now());
  return rid;
end $$;

-- edit a delivery: its figures and its readings (the readings keep their original time)
create or replace function public.update_diesel_refuel(
  p_refuel_id bigint, p_date date, p_invoice_liters numeric, p_dips jsonb,
  p_supplier text default null, p_total numeric default null, p_invoice text default null, p_notes text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare r public.diesel_refuels; at_ timestamptz;
begin
  select * into r from public.diesel_refuels where id = p_refuel_id for update;
  if not found then raise exception 'not found'; end if;
  if coalesce(public.app_role(), '') not in ('admin','supervisor') or not public.can_see_branch(r.branch_id) then raise exception 'not allowed'; end if;
  if p_date is null or p_date > public.riyadh_today() then raise exception 'diesel bad date'; end if;
  if p_invoice_liters is null or p_invoice_liters <= 0 then raise exception 'diesel ordered required'; end if;
  if p_total is not null and p_total < 0 then raise exception 'diesel bad total'; end if;
  select min(read_at) into at_ from public.diesel_dips where refuel_id = p_refuel_id;
  update public.diesel_refuels set refuel_date = p_date, liters = p_invoice_liters, supplier = nullif(trim(p_supplier), ''), total_amount = p_total,
    price_per_liter = case when p_total is not null then round(p_total / p_invoice_liters, 3) end,
    invoice_no = nullif(trim(p_invoice), ''), notes = nullif(trim(p_notes), '')
  where id = p_refuel_id;
  perform public.diesel_refuel_readings(p_refuel_id, r.branch_id, p_invoice_liters, p_dips, coalesce(at_, now()));
  return p_refuel_id;
end $$;
revoke execute on function public.update_diesel_refuel(bigint, date, numeric, jsonb, text, numeric, text, text) from public, anon;
grant execute on function public.update_diesel_refuel(bigint, date, numeric, jsonb, text, numeric, text, text) to authenticated;

-- a level reading without a delivery, in centimetres or litres
create or replace function public.record_diesel_check(p_branch_id bigint, p_dips jsonb, p_notes text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare d jsonb; t public.diesel_tanks; x record; n int := 0;
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor') or not public.can_see_branch(p_branch_id) then raise exception 'not allowed'; end if;
  for d in select * from jsonb_array_elements(coalesce(p_dips, '[]'::jsonb)) loop
    select * into t from public.diesel_tanks where id = (d->>'tank_id')::bigint and branch_id = p_branch_id and active;
    if not found then raise exception 'diesel tank not in branch'; end if;
    select * into x from public.diesel_reading(t, (d->>'cm')::numeric, (d->>'liters')::numeric);
    insert into public.diesel_dips (tank_id, branch_id, level_cm, liters, kind, notes, entered_as, created_by)
    values (t.id, p_branch_id, x.cm, x.liters, 'check', nullif(trim(p_notes), ''), x.entered, auth.uid());
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'diesel readings required'; end if;
  return n;
end $$;
