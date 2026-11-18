-- =====================================================================
-- More tank shapes (same formulas as the CalculatorSoup tank calculator),
-- litres straight from the dimensions for every shape, and calibration
-- tables interpolated along the tank's own shape instead of in straight lines.
--
-- Dimensions per shape (all inside, in cm):
--   box                 length, width, height
--   vertical_cylinder   diameter, height
--   horizontal_cylinder diameter, length
--   horizontal_oval     width, height, length   (width >= height)
--   vertical_oval       width, height, length   (height >= width)
--   horizontal_capsule  diameter, length = straight part between the round ends
--   vertical_capsule    diameter, height = straight part between the round ends
-- =====================================================================
alter table public.diesel_tanks drop constraint if exists diesel_tanks_shape_check;
alter table public.diesel_tanks add constraint diesel_tanks_shape_check check (shape in (
  'box','vertical_cylinder','horizontal_cylinder','horizontal_oval','vertical_oval','horizontal_capsule','vertical_capsule'));
alter table public.diesel_tanks alter column measure_by set default 'liters';

-- area (cm²) of a circle segment of height h in a circle of radius r
create or replace function public.circle_segment(r numeric, h numeric) returns numeric
language sql immutable set search_path = '' as $$
  select case when r is null or r <= 0 then null else
    (r * r * acos(greatest(least((r - least(greatest(h, 0), 2 * r)) / r, 1), -1))
     - (r - least(greatest(h, 0), 2 * r)) * sqrt(greatest(2 * r * least(greatest(h, 0), 2 * r) - power(least(greatest(h, 0), 2 * r), 2), 0)))::numeric end
$$;

-- volume (cm³) of a sphere cap of height h on a sphere of radius r
create or replace function public.sphere_cap(r numeric, h numeric) returns numeric
language sql immutable set search_path = '' as $$
  select (pi() * power(least(greatest(h, 0), 2 * r), 2) * (3 * r - least(greatest(h, 0), 2 * r)) / 3)::numeric
$$;

create or replace function public.tank_full_cm(t public.diesel_tanks) returns numeric
language sql immutable set search_path = '' as $$
  select case
    when t.shape in ('horizontal_cylinder','horizontal_capsule') then t.diameter_cm
    when t.shape = 'vertical_capsule' then t.height_cm + t.diameter_cm
    else t.height_cm end
$$;

-- litres from the dimensions alone (null when a dimension is missing)
create or replace function public.tank_geo_liters(t public.diesel_tanks, p_cm numeric) returns numeric
language plpgsql immutable set search_path = '' as $$
declare f numeric; r numeric; a numeric; v numeric; full_h numeric;
begin
  if p_cm is null then return null; end if;
  full_h := public.tank_full_cm(t);
  if full_h is null then return null; end if;
  f := least(greatest(p_cm, 0), full_h);
  if t.shape = 'box' then
    v := f * t.length_cm * t.width_cm;
  elsif t.shape = 'vertical_cylinder' then
    v := pi() * power(t.diameter_cm / 2, 2) * f;
  elsif t.shape = 'horizontal_cylinder' then
    v := t.length_cm * public.circle_segment(t.diameter_cm / 2, f);
  elsif t.shape = 'horizontal_oval' then
    r := t.height_cm / 2; a := greatest(t.width_cm - t.height_cm, 0);
    v := t.length_cm * (public.circle_segment(r, f) + a * f);
  elsif t.shape = 'vertical_oval' then
    r := t.width_cm / 2; a := greatest(t.height_cm - t.width_cm, 0);
    v := t.length_cm * case
      when f <= r then public.circle_segment(r, f)
      when f <= r + a then pi() * r * r / 2 + t.width_cm * (f - r)
      else pi() * r * r + t.width_cm * a - public.circle_segment(r, t.height_cm - f) end;
  elsif t.shape = 'horizontal_capsule' then
    r := t.diameter_cm / 2;
    v := t.length_cm * public.circle_segment(r, f) + public.sphere_cap(r, f);
  elsif t.shape = 'vertical_capsule' then
    r := t.diameter_cm / 2; a := t.height_cm;
    v := case
      when f <= r then public.sphere_cap(r, f)
      when f <= r + a then 2 * pi() * power(r, 3) / 3 + pi() * r * r * (f - r)
      else 4 * pi() * power(r, 3) / 3 + pi() * r * r * a - public.sphere_cap(r, full_h - f) end;
  end if;
  return v / 1000;
end $$;

-- litres at a dipstick reading: the calibration table when there is one
-- (followed along the tank's shape between its points), else the dimensions
create or replace function public.tank_liters(p_tank bigint, p_cm numeric) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare t public.diesel_tanks; lo_cm numeric; lo_l numeric; hi_cm numeric; hi_l numeric; g numeric; glo numeric; ghi numeric;
begin
  if p_cm is null then return null; end if;
  select * into t from public.diesel_tanks where id = p_tank;
  if not found then return null; end if;

  if exists (select 1 from public.diesel_tank_points where tank_id = p_tank) then
    select level_cm, liters into lo_cm, lo_l from public.diesel_tank_points where tank_id = p_tank and level_cm <= p_cm order by level_cm desc limit 1;
    select level_cm, liters into hi_cm, hi_l from public.diesel_tank_points where tank_id = p_tank and level_cm >= p_cm order by level_cm asc limit 1;
    lo_cm := coalesce(lo_cm, 0); lo_l := coalesce(lo_l, 0);
    g := public.tank_geo_liters(t, p_cm); glo := public.tank_geo_liters(t, lo_cm);
    if hi_cm is null then
      -- above the table: carry on along the shape, scaled like the highest point
      if g is null or glo is null then return round(lo_l, 1); end if;
      return round(lo_l + (g - glo) * case when glo > 0 then lo_l / glo else 1 end, 1);
    end if;
    if hi_cm = lo_cm then return round(hi_l, 1); end if;
    ghi := public.tank_geo_liters(t, hi_cm);
    if g is not null and ghi - glo > 0 then
      return round(lo_l + (hi_l - lo_l) * (g - glo) / (ghi - glo), 1);
    end if;
    return round(lo_l + (hi_l - lo_l) * (p_cm - lo_cm) / (hi_cm - lo_cm), 1);
  end if;

  return round(public.tank_geo_liters(t, p_cm), 1);
end $$;

revoke execute on function public.tank_geo_liters(public.diesel_tanks, numeric) from public, anon;
grant execute on function public.tank_geo_liters(public.diesel_tanks, numeric) to authenticated;

-- every tank shows litres from its dimensions now; "cm" stays as a choice
update public.diesel_tanks set measure_by = 'liters' where measure_by = 'cm';
