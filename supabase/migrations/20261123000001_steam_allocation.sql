-- =====================================================================
-- Diesel by machine. The boiler burns the diesel; its steam goes to the
-- dryers and presses (and any other steam machine added to the branch's
-- equipment). Each machine's share of the diesel = its steam ÷ all steam.
--   dryer : cycles × cycle minutes/60 × valve-open factor × kg/h
--   press : pieces × presses per piece × seconds per press/3600 × kg/h
--   other : hours  × kg/h
-- Counts are entered per machine per day; the share is worked out per month.
-- =====================================================================

-- which equipment takes steam from the central boiler, and how much
alter table public.equipment
  add column if not exists steam_type text check (steam_type in ('dryer','press','other')),
  add column if not exists steam_kg_h numeric check (steam_kg_h > 0),
  add column if not exists cycle_minutes numeric check (cycle_minutes > 0);

-- the assumptions, editable by the admin (one row)
create table public.steam_settings (
  id                 int primary key default 1 check (id = 1),
  dryer_kg_h         numeric not null default 60   check (dryer_kg_h > 0),
  press_kg_h         numeric not null default 17.5 check (press_kg_h > 0),
  dryer_cycle_min    numeric not null default 20   check (dryer_cycle_min > 0),
  dryer_valve_factor numeric not null default 0.68 check (dryer_valve_factor > 0 and dryer_valve_factor <= 1),
  presses_per_item   numeric not null default 12   check (presses_per_item > 0),
  seconds_per_press  numeric not null default 3.5  check (seconds_per_press > 0),
  updated_at         timestamptz not null default now()
);
insert into public.steam_settings (id) values (1) on conflict do nothing;
create trigger trg_steam_settings_updated before update on public.steam_settings for each row execute function public.set_updated_at();
create trigger trg_audit_steam_settings after insert or update or delete on public.steam_settings for each row execute function public.audit_trigger();
alter table public.steam_settings enable row level security;
create policy steam_settings_read on public.steam_settings for select to authenticated using (public.is_active_user());
create policy steam_settings_admin on public.steam_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.steam_settings from anon;

-- daily counts per machine: dryer cycles, pressed pieces, or hours for other machines
create table public.steam_counts (
  equipment_id bigint not null references public.equipment(id) on delete restrict,
  branch_id    bigint not null references public.branches(id),
  day          date not null,
  units        numeric not null check (units >= 0),
  entered_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (equipment_id, day)
);
create index on public.steam_counts (branch_id, day);
create trigger trg_steam_counts_updated before update on public.steam_counts for each row execute function public.set_updated_at();
create trigger trg_audit_steam_counts after insert or update or delete on public.steam_counts for each row execute function public.audit_trigger();
alter table public.steam_counts enable row level security;
create policy steam_counts_read on public.steam_counts for select to authenticated using (public.can_see_branch(branch_id));
revoke all on public.steam_counts from anon;

-- save one day's counts for a branch: {equipment_id, units|null}; null clears that machine's count
create or replace function public.save_steam_counts(p_branch_id bigint, p_day date, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb; e public.equipment; u numeric; n int := 0;
begin
  if coalesce(public.app_role(), '') not in ('admin','supervisor') or not public.can_see_branch(p_branch_id) then raise exception 'not allowed'; end if;
  if p_day is null or p_day > public.riyadh_today() then raise exception 'steam bad date'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    select * into e from public.equipment where id = (r->>'equipment_id')::bigint;
    if not found or e.branch_id <> p_branch_id or e.steam_type is null then raise exception 'steam machine not in branch'; end if;
    u := nullif(r->>'units', '')::numeric;
    if u is null then
      delete from public.steam_counts where equipment_id = e.id and day = p_day;
    else
      if u < 0 then raise exception 'steam bad count'; end if;
      insert into public.steam_counts (equipment_id, branch_id, day, units, entered_by)
      values (e.id, p_branch_id, p_day, u, auth.uid())
      on conflict (equipment_id, day) do update set units = excluded.units, entered_by = excluded.entered_by;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.save_steam_counts(bigint, date, jsonb) from public, anon;
grant execute on function public.save_steam_counts(bigint, date, jsonb) to authenticated;
