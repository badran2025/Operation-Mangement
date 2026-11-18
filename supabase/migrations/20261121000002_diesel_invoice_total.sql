-- Deliveries keep the full picture on the row: litres before, litres filled,
-- litres after, litres on the invoice, invoice total, and price per litre
-- worked out from the total (total ÷ invoice litres).
alter table public.diesel_refuels
  add column if not exists before_liters numeric,
  add column if not exists after_liters  numeric,
  add column if not exists total_amount  numeric check (total_amount >= 0);
comment on column public.diesel_refuels.liters is 'litres written on the invoice';
comment on column public.diesel_refuels.received_liters is 'litres actually filled (after − before, from the dipstick)';
comment on column public.diesel_refuels.price_per_liter is 'invoice total ÷ invoice litres';

drop function if exists public.record_diesel_refuel(bigint, date, numeric, jsonb, text, numeric, text, text);
create function public.record_diesel_refuel(
  p_branch_id bigint, p_date date, p_invoice_liters numeric, p_dips jsonb,
  p_supplier text default null, p_total numeric default null, p_invoice text default null, p_notes text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare rid bigint; d jsonb; t public.diesel_tanks; b numeric; a numeric; bl numeric; al numeric;
        sum_b numeric := 0; sum_a numeric := 0; n int := 0;
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
    bl := public.tank_liters(t.id, b); al := public.tank_liters(t.id, a);
    insert into public.diesel_dips (tank_id, branch_id, read_at, level_cm, liters, kind, refuel_id, created_by)
    values (t.id, p_branch_id, now(), b, bl, 'before', rid, auth.uid()),
           (t.id, p_branch_id, now(), a, al, 'after', rid, auth.uid());
    sum_b := sum_b + bl; sum_a := sum_a + al; n := n + 1;
  end loop;
  if n = 0 then raise exception 'diesel readings required'; end if;

  update public.diesel_refuels set
    before_liters = round(sum_b, 1), after_liters = round(sum_a, 1), received_liters = round(sum_a - sum_b, 1),
    shortage_liters = greatest(round(p_invoice_liters - (sum_a - sum_b), 1), 0)
  where id = rid;
  return rid;
end $$;
revoke execute on function public.record_diesel_refuel(bigint, date, numeric, jsonb, text, numeric, text, text) from public, anon;
grant execute on function public.record_diesel_refuel(bigint, date, numeric, jsonb, text, numeric, text, text) to authenticated;
