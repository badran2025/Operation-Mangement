-- Plan items become three fixed sections per topic:
--   file   = files / records that must exist
--   review = what is reviewed, and how often
--   action = what is done, and when
alter table public.plan_items
  add column if not exists kind text not null default 'action' check (kind in ('file','review','action')),
  add column if not exists frequency text check (frequency in ('daily','weekly','monthly','quarterly','yearly'));

-- the attendance starter items were questions to settle, so put them where they belong
update public.plan_nodes set policy = coalesce(policy,
  E'مواعيد الحضور وفترة السماح للتأخير: \n'
  || E'خصم التأخير والغياب بدون إذن: \n'
  || E'طريقة طلب الإجازة والموافقة عليها: ')
 where title = 'الحضور والغياب';
delete from public.plan_items i using public.plan_nodes n
 where i.node_id = n.id and n.title = 'الحضور والغياب'
   and i.body in ('مواعيد الحضور وفترة السماح للتأخير','خصم التأخير والغياب بدون إذن','طريقة طلب الإجازة والموافقة عليها',
                  'مين يراجع الحضور يومياً ومين يعتمده آخر الشهر','التأكد إن كل العمال متسجلين على Odoo');
insert into public.plan_items (node_id, kind, frequency, body, sort)
select n.id, v.kind, v.freq, v.body, v.s from public.plan_nodes n, (values
  ('review','daily','الحضور والتأخير والغياب في كل فرع على Odoo', 0),
  ('review','monthly','اعتماد الحضور الشهري قبل الرواتب', 1),
  ('review','monthly','كل العمال الجداد متسجلين على Odoo', 2)) v(kind, freq, body, s)
 where n.title = 'الحضور والغياب'
   and not exists (select 1 from public.plan_items i where i.node_id = n.id and i.body = v.body);

-- status now means "is this topic's structure defined"
comment on column public.plan_nodes.status is 'todo = not started, doing = being defined, done = defined';
