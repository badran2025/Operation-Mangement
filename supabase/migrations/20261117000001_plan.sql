-- =====================================================================
-- Plan tab: an operations mind map. Each node is a topic to prepare,
-- with a status, notes, an optional link to a page on the site, and a
-- checklist of what has to be prepared. Admin only.
-- =====================================================================

create table public.plan_nodes (
  id         bigint generated always as identity primary key,
  parent_id  bigint references public.plan_nodes(id) on delete cascade,
  title      text not null check (length(trim(title)) > 0),
  status     text not null default 'todo' check (status in ('todo','doing','done')),
  notes      text,
  link       text,
  sort       int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plan_nodes_parent on public.plan_nodes(parent_id);

create table public.plan_items (
  id         bigint generated always as identity primary key,
  node_id    bigint not null references public.plan_nodes(id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  done       boolean not null default false,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index plan_items_node on public.plan_items(node_id);

create trigger plan_nodes_touch before update on public.plan_nodes
  for each row execute function public.set_updated_at();

alter table public.plan_nodes enable row level security;
alter table public.plan_items enable row level security;
create policy plan_nodes_admin on public.plan_nodes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy plan_items_admin on public.plan_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.plan_nodes, public.plan_items from anon;
grant select, insert, update, delete on public.plan_nodes, public.plan_items to authenticated;

-- a node can never be moved under itself or one of its own children
create or replace function public.plan_no_cycle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null and exists (
    with recursive up as (
      select id, parent_id from public.plan_nodes where id = new.parent_id
      union all
      select p.id, p.parent_id from public.plan_nodes p join up on p.id = up.parent_id
    ) select 1 from up where id = new.id) then
    raise exception 'plan cycle';
  end if;
  return new;
end $$;
create trigger plan_nodes_no_cycle before update of parent_id on public.plan_nodes
  for each row execute function public.plan_no_cycle();

-- ---------- starter map (the draft agreed in chat; editable from the site) ----------
do $$
declare tree jsonb := $j$
{"t":"تشغيل كلين","c":[
  {"t":"الفروع","l":"/","c":[
    {"t":"بيانات الفرع","c":[
      {"t":"ساعات العمل","l":"/"},{"t":"التراخيص: بلدية ودفاع مدني"},{"t":"الإيجار والعقود"},
      {"t":"الكهرباء والمياه"},{"t":"الديزل"}]},
    {"t":"العمال","l":"/workers","c":[
      {"t":"الدوامات والإجازات الأسبوعية","l":"/workers"},
      {"t":"الزي: المقاسات والتسليم والاستبدال"},
      {"t":"المستندات: إقامة، تأمين، بلدية، كشف طبي","l":"/documents"},
      {"t":"السكن والمواصلات","l":"/housing"},
      {"t":"المهام والمسؤوليات حسب الوظيفة"},
      {"t":"التدريب"},
      {"t":"الحضور والغياب"}]},
    {"t":"المعدات","c":[
      {"t":"سجل المعدات لكل فرع: النوع، الموديل، الرقم التسلسلي"},
      {"t":"الصيانة الوقائية (PPM)"},
      {"t":"بلاغات الصيانة","l":"/maintenance"},
      {"t":"قطع الغيار"},
      {"t":"الضمان والموردين"}]},
    {"t":"المواد","c":[
      {"t":"قائمة المواد: منظفات، كيماويات، شماعات، أكياس، تغليف"},
      {"t":"دورة الطلب: طلب ← موافقة ← صرف ← استلام"},
      {"t":"الحد الأدنى للمخزون في كل فرع"},
      {"t":"معدل الاستهلاك"},
      {"t":"الموردين والأسعار"}]}]},
  {"t":"فريق التشغيل","l":"/users","c":[
    {"t":"الأدوار: مدير تشغيل، مشرفين، مدير صيانة، فنيين","l":"/users"},
    {"t":"مهام كل دور: يومية / أسبوعية / شهرية"},
    {"t":"التقارير والمتابعة"}]},
  {"t":"الإجراءات (SOP)","c":[
    {"t":"فتح وقفل الفرع"},{"t":"استلام وتسليم الملابس"},{"t":"الغسيل والكوي"},
    {"t":"الشكاوى والتعويضات"},{"t":"السلامة والطوارئ"},{"t":"النظافة"}]}
]}
$j$;
begin
  if exists (select 1 from public.plan_nodes) then return; end if;
  create temp table _q (node jsonb, parent bigint, ord int) on commit drop;
  insert into _q values (tree, null, 0);
  declare r record; nid bigint; i int;
  begin
    loop
      select * into r from _q limit 1;
      exit when not found;
      delete from _q where ctid = (select ctid from _q limit 1);
      insert into public.plan_nodes (parent_id, title, link, sort) values (r.parent, r.node->>'t', r.node->>'l', r.ord) returning id into nid;
      i := 0;
      if r.node ? 'c' then
        for i in 0 .. jsonb_array_length(r.node->'c') - 1 loop
          insert into _q values (r.node->'c'->i, nid, i);
        end loop;
      end if;
    end loop;
  end;
end $$;
