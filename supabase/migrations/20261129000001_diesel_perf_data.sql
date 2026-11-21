-- =====================================================================
-- Diesel performance is compared against the whole network, whoever looks.
-- A supervisor sees the details of their own branches only, but the network
-- average, the status of a branch and the "similar branch" comparison are
-- worked out from every diesel branch, so everyone sees the same status.
-- This returns the figures the comparison needs (numbers only, no people).
-- =====================================================================
create or replace function public.diesel_perf_data(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor') then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'branches', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name_ar', b.name_ar, 'name_en', b.name_en, 'city_id', b.city_id, 'status', b.status, 'power_source', b.power_source, 'sort', b.sort) order by b.city_id, b.sort), '[]') from public.branches b),
    'cities', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name_ar', c.name_ar, 'name_en', c.name_en)), '[]') from public.cities c),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('branch_id', m.branch_id, 'month', m.month, 'pieces', m.pieces, 'blankets', m.blankets, 'liters', m.liters, 'cost', m.cost, 'estimated', m.estimated, 'source', m.source)), '[]')
               from public.branch_months m where m.month between p_from and p_to),
    -- readings: from well before the period (the drop between two readings is split over the days between them) up to now
    'dips', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'tank_id', d.tank_id, 'branch_id', d.branch_id, 'read_at', d.read_at, 'liters', d.liters, 'kind', d.kind, 'refuel_id', d.refuel_id) order by d.read_at, d.id), '[]')
             from public.diesel_dips d where d.read_at >= (p_from - interval '200 days')),
    'refuels', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'branch_id', r.branch_id, 'refuel_date', r.refuel_date, 'liters', r.liters, 'received_liters', r.received_liters, 'total_amount', r.total_amount, 'supplier', r.supplier, 'supplier_id', r.supplier_id)), '[]')
                from public.diesel_refuels r where r.refuel_date >= (p_from - interval '200 days')),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('branch_id', h.branch_id, 'weekday', h.weekday, 'open_time', h.open_time, 'close_time', h.close_time, 'is_24h', h.is_24h, 'is_closed', h.is_closed)), '[]') from public.branch_hours h),
    'stops', (select coalesce(jsonb_agg(jsonb_build_object('branch_id', s.branch_id, 'started_at', s.started_at, 'ended_at', s.ended_at)), '[]')
              from public.branch_downtimes s where s.started_at < (p_to + interval '1 month') and (s.ended_at is null or s.ended_at > (p_from - interval '200 days'))),
    'suppliers', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'price_per_liter', x.price_per_liter)), '[]') from public.diesel_suppliers x)
  );
end $$;
revoke execute on function public.diesel_perf_data(date, date) from public, anon;
grant execute on function public.diesel_perf_data(date, date) to authenticated;
