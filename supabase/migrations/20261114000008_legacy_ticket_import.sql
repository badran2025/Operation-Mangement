-- Admin-only import of old tickets (e.g. from Airtable). Idempotent: skips legacy_ref already present.
create or replace function public.admin_import_legacy_tickets(p jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb; bid bigint; tid bigint; n int := 0; at timestamptz;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  for r in select * from jsonb_array_elements(p) loop
    continue when exists (select 1 from public.tickets where legacy_ref = 'AT-' || (r->>'ref'));
    select id into bid from public.branches
     where lower(r->>'branch') = any (select lower(x) from unnest(aliases || name_en) x) limit 1;
    if bid is null then raise exception 'unknown branch: %', r->>'branch'; end if;
    at := (r->>'at')::timestamptz;
    insert into public.tickets (branch_id, category_id, priority, title, description, status, stops_branch,
                                reporter_name, due_at, legacy_ref, created_at)
    values (bid, (select id from public.ticket_categories where name_en = r->>'cat'), 'normal',
            r->>'title', r->>'desc', r->>'status', coalesce((r->>'stops')::boolean, false),
            r->>'reporter', at + interval '72 hours', 'AT-' || (r->>'ref'), at)
    returning id into tid;
    insert into public.ticket_events (ticket_id, kind, body, created_at)
    values (tid, 'created', 'منقول من Airtable (بلاغ رقم ' || (r->>'ref') || ')' ||
            case when (r->>'files')::int > 0 then ' — كان فيه ' || (r->>'files') || ' مرفق' else '' end, at);
    if r->>'notes' is not null then
      insert into public.ticket_events (ticket_id, kind, body, created_at)
      values (tid, 'comment', 'ملاحظات Airtable: ' || (r->>'notes'), at + interval '1 minute');
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.admin_import_legacy_tickets(jsonb) from public, anon;
grant execute on function public.admin_import_legacy_tickets(jsonb) to authenticated;
