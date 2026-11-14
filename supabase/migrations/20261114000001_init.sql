-- =====================================================================
-- Kleen Operations — initial schema
-- Weekday convention everywhere: 0 = Sunday ... 6 = Saturday (Postgres DOW)
-- Business time zone: Asia/Riyadh
-- =====================================================================

create extension if not exists btree_gist;

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =====================================================================
-- USERS & PERMISSIONS (people who log in)
-- =====================================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  phone       text,
  role        text not null default 'supervisor'
              check (role in ('admin','supervisor','maintenance_manager','technician')),
  active      boolean not null default false,  -- admin activates new accounts
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- auto-create a profile row when an auth user is created
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- LOCATIONS
-- =====================================================================
create table public.cities (
  id       bigint generated always as identity primary key,
  name_ar  text not null unique,
  name_en  text not null unique,
  sort     int not null default 0
);

create table public.branches (
  id            bigint generated always as identity primary key,
  city_id       bigint not null references public.cities(id),
  name_ar       text not null,
  name_en       text not null,
  aliases       text[] not null default '{}',   -- other spellings used in old sheets
  status        text not null default 'active' check (status in ('active','stopped','closed')),
  phone         text,
  address       text,
  map_url       text,
  hours_note    text,                            -- e.g. "staff start 6 AM (door closed)"
  ppm_weekday   smallint check (ppm_weekday between 0 and 6),  -- deep cleaning & PPM
  ppm_time      time,
  notes         text,
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (city_id, name_en)
);
create trigger trg_branches_updated before update on public.branches
  for each row execute function public.set_updated_at();

-- opening hours per weekday (handles 24h branches and different Friday hours)
create table public.branch_hours (
  branch_id   bigint not null references public.branches(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  open_time   time,
  close_time  time,          -- '24:00' = midnight
  is_24h      boolean not null default false,
  is_closed   boolean not null default false,
  primary key (branch_id, weekday)
);

create table public.branch_files (
  id          bigint generated always as identity primary key,
  branch_id   bigint not null references public.branches(id) on delete cascade,
  kind        text not null check (kind in ('snag_list','technical_report','other')),
  title       text not null,
  file_path   text not null,             -- Supabase Storage path
  uploaded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- which supervisors manage which branches
create table public.profile_branches (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  branch_id   bigint not null references public.branches(id) on delete cascade,
  primary key (profile_id, branch_id)
);

-- branch downtime log (boiler, power, water ...)
create table public.branch_downtimes (
  id          bigint generated always as identity primary key,
  branch_id   bigint not null references public.branches(id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  reason      text not null,
  ticket_id   bigint,                    -- FK added after tickets table
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

-- =====================================================================
-- HOUSING
-- =====================================================================
create table public.housings (
  id             bigint generated always as identity primary key,
  city_id        bigint references public.cities(id),
  name           text not null,
  address        text,
  map_url        text,
  rooms          int,
  capacity       int,
  contact_name   text,
  contact_phone  text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_housings_updated before update on public.housings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- WORKERS
-- =====================================================================
create table public.job_titles (
  id             bigint generated always as identity primary key,
  name_ar        text not null unique,
  name_en        text not null unique,
  uniform_color  text,
  sort           int not null default 0
);

create table public.workers (
  id                 bigint generated always as identity primary key,
  emp_no             text unique,
  full_name          text not null,
  alt_name           text,                -- short / Arabic name used on rosters
  nationality        text,
  gender             text check (gender in ('male','female')),
  phone              text,
  email              text,
  birth_date         date,
  blood_type         text,
  emergency_contact  text,
  photo_path         text,
  status             text not null default 'active'
                     check (status in ('active','on_leave','terminated')),
  joined_at          date,
  housing_id         bigint references public.housings(id) on delete set null,
  shoe_size          text,
  uniform_size       text,
  break_time         time,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.workers (housing_id);
create trigger trg_workers_updated before update on public.workers
  for each row execute function public.set_updated_at();

-- Branch + role history. A transfer closes the open row and opens a new one.
create table public.worker_assignments (
  id            bigint generated always as identity primary key,
  worker_id     bigint not null references public.workers(id) on delete cascade,
  branch_id     bigint not null references public.branches(id),
  job_title_id  bigint references public.job_titles(id),
  start_date    date not null default (now() at time zone 'Asia/Riyadh')::date,
  end_date      date,
  note          text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create unique index worker_one_open_assignment on public.worker_assignments (worker_id) where end_date is null;
create index on public.worker_assignments (branch_id) where end_date is null;

-- Shift segments (a split shift = 2 rows). end '24:00' = midnight.
create table public.worker_shift_segments (
  id          bigint generated always as identity primary key,
  worker_id   bigint not null references public.workers(id) on delete cascade,
  seq         smallint not null default 1,
  start_time  time not null,
  end_time    time not null,
  unique (worker_id, seq)
);

create table public.worker_days_off (
  worker_id  bigint not null references public.workers(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  primary key (worker_id, weekday)
);
-- explicit "this worker has no weekly day off" (different from "not set yet")
alter table public.workers add column no_day_off boolean not null default false;

-- Coverage: worker X covers on a weekday (e.g. coordinator covers Monday 9–9)
create table public.worker_coverages (
  id                 bigint generated always as identity primary key,
  worker_id          bigint not null references public.workers(id) on delete cascade,
  weekday            smallint not null check (weekday between 0 and 6),
  start_time         time,
  end_time           time,
  covers_worker_id   bigint references public.workers(id) on delete set null,
  note               text
);

-- Official documents with expiry (iqama, passport, insurance, ...)
create table public.worker_documents (
  id           bigint generated always as identity primary key,
  worker_id    bigint not null references public.workers(id) on delete cascade,
  doc_type     text not null check (doc_type in ('iqama','passport','insurance','contract','baladiya','medical')),
  number       text,
  issuer       text,               -- e.g. insurance company
  expiry_date  date,
  file_path    text,
  notes        text,
  updated_at   timestamptz not null default now(),
  unique (worker_id, doc_type)
);
create trigger trg_docs_updated before update on public.worker_documents
  for each row execute function public.set_updated_at();

-- =====================================================================
-- OPERATIONS
-- =====================================================================
create table public.diesel_refuels (
  id               bigint generated always as identity primary key,
  branch_id        bigint not null references public.branches(id),
  refuel_date      date not null,
  liters           numeric(8,1) not null check (liters > 0),
  shortage_liters  numeric(8,1) check (shortage_liters >= 0),
  notes            text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);
create index on public.diesel_refuels (branch_id, refuel_date desc);

create table public.diesel_refuel_files (
  id         bigint generated always as identity primary key,
  refuel_id  bigint not null references public.diesel_refuels(id) on delete cascade,
  file_path  text not null
);

-- =====================================================================
-- MAINTENANCE
-- =====================================================================
create table public.ticket_categories (
  id       bigint generated always as identity primary key,
  name_ar  text not null unique,
  name_en  text not null unique,
  sort     int not null default 0
);

create table public.sla_policies (
  priority         text primary key check (priority in ('urgent','high','normal','low')),
  resolve_hours    int not null,
  escalate_hours   int not null
);

create table public.tickets (
  id              bigint generated always as identity primary key,
  branch_id       bigint not null references public.branches(id),
  category_id     bigint references public.ticket_categories(id),
  title           text not null,
  description     text,
  priority        text not null default 'normal' references public.sla_policies(priority),
  status          text not null default 'new'
                  check (status in ('new','assigned','in_progress','waiting_parts','resolved','closed','cancelled')),
  stops_branch    boolean not null default false,
  reported_by     uuid references public.profiles(id),
  reporter_name   text,                    -- for imported tickets / non-users
  assigned_to     uuid references public.profiles(id),
  assignee_name   text,                    -- external technician name when not a user
  due_at          timestamptz,
  resolved_at     timestamptz,
  closed_at       timestamptz,
  last_reminder_at timestamptz,
  legacy_ref      text,                    -- old Airtable ticket number
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.tickets (branch_id, status);
create index on public.tickets (assigned_to, status);
create index on public.tickets (due_at) where status not in ('resolved','closed','cancelled');
create trigger trg_tickets_updated before update on public.tickets
  for each row execute function public.set_updated_at();

alter table public.branch_downtimes
  add constraint branch_downtimes_ticket_fk foreign key (ticket_id) references public.tickets(id) on delete set null;

-- timeline: every comment, status change, assignment, reminder
create table public.ticket_events (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.tickets(id) on delete cascade,
  kind        text not null check (kind in ('created','comment','status','assign','priority','reminder','escalation','parts')),
  body        text,
  from_value  text,
  to_value    text,
  actor       uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index on public.ticket_events (ticket_id, created_at);

create table public.ticket_attachments (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.tickets(id) on delete cascade,
  event_id    bigint references public.ticket_events(id) on delete set null,
  file_path   text not null,
  mime_type   text,
  uploaded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- outbound notifications log (email now, WhatsApp later)
create table public.notifications (
  id          bigint generated always as identity primary key,
  channel     text not null default 'email' check (channel in ('email','whatsapp')),
  recipient   uuid references public.profiles(id),
  subject     text,
  body        text,
  ticket_id   bigint references public.tickets(id) on delete set null,
  status      text not null default 'queued' check (status in ('queued','sent','failed')),
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

-- =====================================================================
-- AUDIT LOG (who changed what, when)
-- =====================================================================
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  row_id      text,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  actor       uuid,
  at          timestamptz not null default now()
);
create index on public.audit_log (table_name, row_id);

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rid text;
begin
  rid := coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id');
  insert into public.audit_log (table_name, row_id, action, old_data, new_data, actor)
  values (tg_table_name, rid, tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
          auth.uid());
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['branches','branch_hours','housings','workers','worker_assignments',
    'worker_shift_segments','worker_days_off','worker_coverages','worker_documents',
    'diesel_refuels','tickets','profiles','profile_branches','branch_downtimes']
  loop
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.audit_trigger()', t);
  end loop;
end $$;
