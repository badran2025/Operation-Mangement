-- =====================================================================
-- Views (security_invoker => respect RLS of the caller), functions, reference data
-- =====================================================================

create or replace function public.riyadh_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Riyadh')::date $$;

create or replace function public.riyadh_weekday() returns smallint
language sql stable as $$ select extract(dow from now() at time zone 'Asia/Riyadh')::smallint $$;

-- current state of each worker (open assignment)
create or replace view public.v_workers_current with (security_invoker = true) as
select w.*,
       a.id            as assignment_id,
       a.branch_id,
       a.job_title_id,
       a.start_date    as assignment_start,
       jt.name_ar      as job_title_ar,
       jt.name_en      as job_title_en,
       h.name          as housing_name,
       coalesce((select array_agg(d.weekday order by d.weekday) from public.worker_days_off d where d.worker_id = w.id), '{}') as days_off,
       coalesce((select jsonb_agg(jsonb_build_object('start', s.start_time, 'end', s.end_time) order by s.seq)
                 from public.worker_shift_segments s where s.worker_id = w.id), '[]') as shifts,
       (w.status = 'active' and (
          a.job_title_id is null
          or not exists (select 1 from public.worker_shift_segments s where s.worker_id = w.id)
          or (not w.no_day_off and not exists (select 1 from public.worker_days_off d where d.worker_id = w.id))
       )) as incomplete,
       exists (select 1 from public.worker_days_off d where d.worker_id = w.id and d.weekday = public.riyadh_weekday()) as off_today
from public.workers w
left join public.worker_assignments a on a.worker_id = w.id and a.end_date is null
left join public.job_titles jt on jt.id = a.job_title_id
left join public.housings h on h.id = w.housing_id;

-- one row per branch with the numbers shown on the branch card
create or replace view public.v_branch_summary with (security_invoker = true) as
select b.id, b.name_ar, b.name_en, b.status, b.city_id, c.name_ar as city_ar, c.name_en as city_en,
       b.sort, c.sort as city_sort,
       count(w.id) filter (where w.status <> 'terminated')                         as workers_total,
       count(w.id) filter (where w.status = 'on_leave')                            as on_leave,
       count(w.id) filter (where w.status = 'active' and w.off_today)              as off_today,
       count(w.id) filter (where w.status = 'active' and not w.off_today)          as working_today,
       count(w.id) filter (where w.incomplete)                                     as incomplete
from public.branches b
join public.cities c on c.id = b.city_id
left join public.v_workers_current w on w.branch_id = b.id
group by b.id, c.id;

-- transfer a worker to another branch / role, keeping history
create or replace function public.transfer_worker(
  p_worker_id bigint, p_branch_id bigint, p_job_title_id bigint,
  p_start_date date default null, p_note text default null)
returns bigint language plpgsql security invoker as $$
declare d date := coalesce(p_start_date, public.riyadh_today()); new_id bigint;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.worker_assignments set end_date = greatest(start_date, d - 1)
   where worker_id = p_worker_id and end_date is null;
  insert into public.worker_assignments (worker_id, branch_id, job_title_id, start_date, note, created_by)
  values (p_worker_id, p_branch_id, p_job_title_id, d, p_note, auth.uid())
  returning id into new_id;
  return new_id;
end $$;

-- ---------- reference data ----------
insert into public.cities (name_ar, name_en, sort) values
  ('الرياض','Riyadh',1), ('جدة','Jeddah',2), ('الخبر','Khobar',3);

insert into public.job_titles (name_ar, name_en, uniform_color, sort) values
  ('منسق فرع','Branch Coordinator','Black',1),
  ('مسؤول جودة','Quality Officer','Blue',2),
  ('مكوجي','Pressman','Blue',3),
  ('غسّال','Washerman','Blue',4),
  ('منسق مغسلة','Laundry Coordinator','Formal',5),
  ('منسق تشغيل','Operation Coordinator','Formal',6),
  ('منسق جودة','Quality Coordinator','Formal',7),
  ('مدير مشروع','Project Manager','Formal',8);

insert into public.ticket_categories (name_ar, name_en, sort) values
  ('تكييف','AC',1), ('غسالة','Washing Machine',2), ('مكبس','Pressing Machine',3),
  ('نشافة','Dryer',4), ('دراي كلين','Dry-Clean',5), ('بويلر','Boiler',6),
  ('المبنى','Facility',7), ('كهرباء وإضاءة','Electrical & Lighting',8),
  ('مياه وصرف','Water & Drainage',9), ('كاميرات وأنظمة','Cameras & IT',10), ('عام','General',11);

insert into public.sla_policies (priority, resolve_hours, escalate_hours) values
  ('urgent', 4, 2), ('high', 24, 12), ('normal', 72, 48), ('low', 168, 120);
