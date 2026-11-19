-- =====================================================================
-- Diesel performance by branch and month (replaces "diesel by machine").
-- One boiler and one diesel figure per branch cannot be split per machine,
-- so the steam allocation, steam tests and hour meters are removed.
-- What is tracked instead: diesel used per 1,000 pieces, per branch and month.
--   pieces / blankets : entered per branch per month (from the orders report)
--   litres / cost     : worked out from the tank readings and invoices; a month
--                       can carry its own figures (months before the site, or an estimate)
-- =====================================================================

-- remove the steam allocation
drop function if exists public.save_steam_counts(bigint, date, jsonb);
drop table if exists public.steam_tests;
drop table if exists public.steam_counts;
drop table if exists public.steam_settings;
alter table public.equipment drop column if exists steam_type, drop column if exists steam_kg_h,
  drop column if exists cycle_minutes, drop column if exists steam_count_by;

-- diesel or electric (electric branches are left out of diesel comparisons)
alter table public.branches add column if not exists power_source text not null default 'diesel' check (power_source in ('diesel','electric'));
update public.branches set power_source = 'electric' where name_en = 'Ishbiliya';

create table public.branch_months (
  branch_id  bigint not null references public.branches(id),
  month      date not null check (extract(day from month) = 1),
  pieces     int check (pieces >= 0),
  blankets   int check (blankets >= 0),
  liters     numeric check (liters >= 0),     -- when set, used instead of the tank readings
  cost       numeric check (cost >= 0),       -- when set, used instead of litres × invoice price
  estimated  boolean not null default false,  -- the litres are an estimate, not measured
  source     text not null default 'manual' check (source in ('manual','import')),
  notes      text,
  updated_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (branch_id, month),
  check (blankets is null or pieces is null or blankets <= pieces)
);
create trigger trg_branch_months_updated before update on public.branch_months for each row execute function public.set_updated_at();
create trigger trg_audit_branch_months after insert or update or delete on public.branch_months for each row execute function public.audit_trigger();
alter table public.branch_months enable row level security;
create policy branch_months_read on public.branch_months for select to authenticated using (public.can_see_branch(branch_id));
create policy branch_months_admin on public.branch_months for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.branch_months from anon;

-- June and July 2026 from the diesel analysis workbook (Al Rakkah June cost corrected to 8,682.28)
insert into public.branch_months (branch_id, month, pieces, blankets, liters, cost, estimated, source) values
(18, '2026-06-01', 21839, null, 5578.0, 8682.28, false, 'import'),
(19, '2026-06-01', 8385, null, 3855.0, 6000.39, false, 'import'),
(20, '2026-06-01', 4107, null, 3258.0, 5071.15, false, 'import'),
(21, '2026-06-01', 337, null, 400.0, 622.61, false, 'import'),
(8, '2026-06-01', 11307, null, 4740.0, 7542.78, false, 'import'),
(3, '2026-06-01', 10438, null, 4206.0, 6693.03, false, 'import'),
(7, '2026-06-01', 9686, null, 5090.0, 8099.74, false, 'import'),
(11, '2026-06-01', 3135, null, 3300.0, 5251.3, false, 'import'),
(6, '2026-06-01', 4636, null, 2390.0, 3803.22, true, 'import'),
(12, '2026-06-01', 4639, null, 3910.0, 6222.0, false, 'import'),
(4, '2026-06-01', 13331, null, 3830.0, 6094.7, false, 'import'),
(2, '2026-06-01', 6637, null, 4930.0, 7845.13, false, 'import'),
(10, '2026-06-01', 8010, null, 3340.0, 5314.96, false, 'import'),
(14, '2026-06-01', 2136, null, 2390.0, 3803.22, true, 'import'),
(9, '2026-06-01', 9412, null, 2975.0, 4734.13, false, 'import'),
(5, '2026-06-01', 12427, null, 3270.0, 5203.57, false, 'import'),
(13, '2026-06-01', 4194, null, 2511.0, 3995.77, false, 'import'),
(17, '2026-06-01', 7133, null, 3618.0, 5631.5, true, 'import'),
(16, '2026-06-01', 12604, null, 3618.0, 5631.5, true, 'import'),
(15, '2026-06-01', 7158, null, 3900.0, 6070.43, true, 'import'),
(18, '2026-07-01', 25147, null, 6169.0, 9602.18, false, 'import'),
(19, '2026-07-01', 9327, null, 2710.0, 4218.17, false, 'import'),
(20, '2026-07-01', 5579, null, 1955.0, 3043.0, false, 'import'),
(21, '2026-07-01', 281, null, 225.0, 350.22, false, 'import'),
(8, '2026-07-01', 14059, null, 6915.0, 11003.87, false, 'import'),
(3, '2026-07-01', 11044, null, 4909.0, 7811.71, false, 'import'),
(7, '2026-07-01', 9788, null, 6550.0, 10423.04, false, 'import'),
(11, '2026-07-01', 3428, null, 2460.0, 3914.61, false, 'import'),
(6, '2026-07-01', 5488, null, 2440.0, 3882.78, false, 'import'),
(12, '2026-07-01', 5530, null, 2850.0, 4535.22, false, 'import'),
(4, '2026-07-01', 17872, null, 4230.0, 6731.22, false, 'import'),
(2, '2026-07-01', 8091, null, 4250.0, 6763.04, false, 'import'),
(10, '2026-07-01', 10555, null, 2900.0, 4614.78, false, 'import'),
(14, '2026-07-01', 7521, null, 2360.0, 3755.48, false, 'import'),
(9, '2026-07-01', 13981, null, 4413.0, 7022.43, false, 'import'),
(5, '2026-07-01', 12468, null, 2490.0, 3962.35, false, 'import'),
(13, '2026-07-01', 3589, null, 2565.0, 4081.7, false, 'import'),
(17, '2026-07-01', 9186, null, 3618.0, 5631.5, true, 'import'),
(16, '2026-07-01', 17601, null, 3818.0, 5942.8, false, 'import'),
(15, '2026-07-01', 8766, null, 3900.0, 6070.43, true, 'import')
on conflict (branch_id, month) do nothing;
