-- =====================================================================
-- Readings carry the date they were taken, not the date they were typed in.
--  * a delivery's readings take the delivery date (noon, or now if it is today)
--  * a level reading takes the date and time written in the form
--  * readings already saved with the typing date are moved to their delivery date
-- =====================================================================
create or replace function public.diesel_at(p_date date) returns timestamptz
language sql stable set search_path = '' as $$
  select case when p_date >= public.riyadh_today() then now()
              else (p_date::timestamp + time '12:00') at time zone 'Asia/Riyadh' end
$$;
revoke execute on function public.diesel_at(date) from public, anon;
grant execute on function public.diesel_at(date) to authenticated;

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
  perform public.diesel_refuel_readings(rid, p_branch_id, p_invoice_liters, p_dips, public.diesel_at(p_date));
  return rid;
end $$;

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
  -- same date: the readings keep their time; a new date: they move with it
  select min(read_at) into at_ from public.diesel_dips where refuel_id = p_refuel_id;
  if p_date <> r.refuel_date or at_ is null or (at_ at time zone 'Asia/Riyadh')::date <> p_date then at_ := public.diesel_at(p_date); end if;
  update public.diesel_refuels set refuel_date = p_date, liters = p_invoice_liters, supplier = nullif(trim(p_supplier), ''), total_amount = p_total,
    price_per_liter = case when p_total is not null then round(p_total / p_invoice_liters, 3) end,
    invoice_no = nullif(trim(p_invoice), ''), notes = nullif(trim(p_notes), '')
  where id = p_refuel_id;
  perform public.diesel_refuel_readings(p_refuel_id, r.branch_id, p_invoice_liters, p_dips, at_);
  return p_refuel_id;
end $$;

-- a level reading at the date and time it was taken
drop function if exists public.record_diesel_check(bigint, jsonb, text);
create or replace function public.record_diesel_check(p_branch_id bigint, p_dips jsonb, p_notes text default null, p_at timestamptz default null)
returns int language plpgsql security definer set search_path = '' as $$
declare d jsonb; t public.diesel_tanks; x record; n int := 0; at_ timestamptz := coalesce(p_at, now());
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor') or not public.can_see_branch(p_branch_id) then raise exception 'not allowed'; end if;
  if at_ > now() + interval '5 minutes' then raise exception 'diesel bad date'; end if;
  for d in select * from jsonb_array_elements(coalesce(p_dips, '[]'::jsonb)) loop
    select * into t from public.diesel_tanks where id = (d->>'tank_id')::bigint and branch_id = p_branch_id and active;
    if not found then raise exception 'diesel tank not in branch'; end if;
    select * into x from public.diesel_reading(t, (d->>'cm')::numeric, (d->>'liters')::numeric);
    insert into public.diesel_dips (tank_id, branch_id, read_at, level_cm, liters, kind, notes, entered_as, created_by)
    values (t.id, p_branch_id, at_, x.cm, x.liters, 'check', nullif(trim(p_notes), ''), x.entered, auth.uid());
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'diesel readings required'; end if;
  return n;
end $$;
revoke execute on function public.record_diesel_check(bigint, jsonb, text, timestamptz) from public, anon;
grant execute on function public.record_diesel_check(bigint, jsonb, text, timestamptz) to authenticated;

-- move readings saved with the typing date to their delivery date
update public.diesel_dips d set read_at = (r.refuel_date::timestamp + time '12:00') at time zone 'Asia/Riyadh'
from public.diesel_refuels r
where d.refuel_id = r.id and (d.read_at at time zone 'Asia/Riyadh')::date <> r.refuel_date;
