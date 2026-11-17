-- Plan: where each item runs (this site, Odoo, sheets…) and its basic rules / policy.
alter table public.plan_nodes add column if not exists platform text, add column if not exists policy text;
update public.plan_nodes set platform = 'site' where link is not null and platform is null;
update public.plan_nodes set platform = 'odoo' where title = 'الحضور والغياب' and platform is null;
insert into public.plan_items (node_id, body, sort)
select n.id, v.body, v.s from public.plan_nodes n, (values
  ('التأكد إن كل العمال متسجلين على Odoo', 0),
  ('مواعيد الحضور وفترة السماح للتأخير', 1),
  ('خصم التأخير والغياب بدون إذن', 2),
  ('طريقة طلب الإجازة والموافقة عليها', 3),
  ('مين يراجع الحضور يومياً ومين يعتمده آخر الشهر', 4)) v(body, s)
where n.title = 'الحضور والغياب' and not exists (select 1 from public.plan_items i where i.node_id = n.id);
