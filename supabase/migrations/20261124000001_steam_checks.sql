-- =====================================================================
-- Catching machines that use more steam than they should.
--  a) expected vs actual: the steam the machines should have used ÷ kg of
--     steam per litre of diesel = the diesel they explain; the rest is
--     "unexplained" (boiler idling, leaks, a faulty machine...).
--  b) steam tests: condensate collected from a machine's steam trap for a few
--     minutes and weighed = its real kg/h; the latest test replaces the catalogue.
--  c) hour meters on the steam valves: the daily entry becomes the meter
--     reading, and the real valve-open hours replace the assumptions.
-- =====================================================================
alter table public.steam_settings
  add column if not exists steam_per_liter      numeric not null default 11 check (steam_per_liter > 0),
  add column if not exists test_alert_pct       numeric not null default 20 check (test_alert_pct > 0),
  add column if not exists test_every_days      int     not null default 90 check (test_every_days > 0),
  add column if not exists unexplained_jump_pct numeric not null default 15 check (unexplained_jump_pct > 0);

-- c) how a machine is counted each day
alter table public.equipment add column if not exists steam_count_by text not null default 'count' check (steam_count_by in ('count','meter'));
alter table public.steam_counts alter column units drop not null;
alter table public.steam_counts add column if not exists meter_reading numeric check (meter_reading >= 0);
alter table public.steam_counts add constraint steam_counts_has_value check (units is not null or meter_reading is not null);

-- b) steam tests
create table public.steam_tests (
  id            bigint generated always as identity primary key,
  equipment_id  bigint not null references public.equipment(id) on delete restrict,
  branch_id     bigint not null references public.branches(id),
  tested_on     date not null,
  minutes       numeric not null check (minutes > 0 and minutes <= 240),
  condensate_kg numeric not null check (condensate_kg > 0),
  kg_h          numeric generated always as (round(condensate_kg * 60 / minutes, 2)) stored,
  notes         text,
  created_by    uuid references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index on public.steam_tests (equipment_id, tested_on desc);
create trigger trg_audit_steam_tests after insert or update or delete on public.steam_tests for each row execute function public.audit_trigger();
alter table public.steam_tests enable row level security;
create policy steam_tests_read on public.steam_tests for select to authenticated using (public.can_see_branch(branch_id) or public.app_role() = 'maintenance_manager');
create policy steam_tests_add on public.steam_tests for insert to authenticated with check (
  public.app_role() in ('admin','supervisor','maintenance_manager') and (public.can_see_branch(branch_id) or public.app_role() = 'maintenance_manager')
  and tested_on <= public.riyadh_today()
  and exists (select 1 from public.equipment e where e.id = equipment_id and e.branch_id = steam_tests.branch_id and e.steam_type is not null));
create policy steam_tests_admin_delete on public.steam_tests for delete to authenticated using (public.is_admin());
revoke all on public.steam_tests from anon;

-- daily entry: a count, or an hour-meter reading for metered machines
create or replace function public.save_steam_counts(p_branch_id bigint, p_day date, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb; e public.equipment; u numeric; mr numeric; prev numeric; nxt numeric; n int := 0;
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor') or not public.can_see_branch(p_branch_id) then raise exception 'not allowed'; end if;
  if p_day is null or p_day > public.riyadh_today() then raise exception 'steam bad date'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    select * into e from public.equipment where id = (r->>'equipment_id')::bigint;
    if not found or e.branch_id <> p_branch_id or e.steam_type is null then raise exception 'steam machine not in branch'; end if;
    u := nullif(r->>'units', '')::numeric;
    mr := nullif(r->>'meter', '')::numeric;
    if e.steam_count_by = 'meter' then u := null; else mr := null; end if;
    if u is null and mr is null then
      delete from public.steam_counts where equipment_id = e.id and day = p_day;
      continue;
    end if;
    if coalesce(u, 0) < 0 or coalesce(mr, 0) < 0 then raise exception 'steam bad count'; end if;
    if mr is not null then
      select meter_reading into prev from public.steam_counts where equipment_id = e.id and day < p_day and meter_reading is not null order by day desc limit 1;
      select meter_reading into nxt  from public.steam_counts where equipment_id = e.id and day > p_day and meter_reading is not null order by day asc limit 1;
      if (prev is not null and mr < prev) or (nxt is not null and mr > nxt) then raise exception 'steam meter backwards'; end if;
    end if;
    insert into public.steam_counts (equipment_id, branch_id, day, units, meter_reading, entered_by)
    values (e.id, p_branch_id, p_day, u, mr, auth.uid())
    on conflict (equipment_id, day) do update set units = excluded.units, meter_reading = excluded.meter_reading, entered_by = excluded.entered_by;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.save_steam_counts(bigint, date, jsonb) from public, anon;
grant execute on function public.save_steam_counts(bigint, date, jsonb) to authenticated;
