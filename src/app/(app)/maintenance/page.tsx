import Link from "next/link";
import { requireActive } from "@/lib/auth";
import { dueLabel, OPEN_STATUSES, PRIORITY, TICKET_STATUS, timeAgo, type TicketRow } from "@/lib/tickets";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "open", label: "مفتوحة" },
  { key: "overdue", label: "متأخرة" },
  { key: "parts", label: "مستني قطع" },
  { key: "resolved", label: "مستني تأكيد" },
  { key: "closed", label: "مقفولة" },
  { key: "all", label: "الكل" },
] as const;

type SP = { tab?: string; branch?: string; cat?: string; q?: string };

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "open";
  const { supabase, profile } = await requireActive();

  let q = supabase.from("v_tickets").select("*").limit(300);
  if (tab === "open") q = q.in("status", OPEN_STATUSES);
  if (tab === "overdue") q = q.eq("overdue", true);
  if (tab === "parts") q = q.eq("status", "waiting_parts");
  if (tab === "resolved") q = q.eq("status", "resolved");
  if (tab === "closed") q = q.in("status", ["closed", "cancelled"]);
  if (sp.branch) q = q.eq("branch_id", Number(sp.branch));
  if (sp.cat) q = q.eq("category_id", Number(sp.cat));
  if (sp.q) q = q.ilike("title", `%${sp.q}%`);
  q = tab === "closed" || tab === "all" ? q.order("created_at", { ascending: false }) : q.order("due_at", { ascending: true });

  const [{ data }, { data: counts }, { data: branches }, { data: cats }] = await Promise.all([
    q,
    supabase.from("v_tickets").select("status, overdue, stops_branch"),
    supabase.from("branches").select("id, name_ar").order("city_id").order("sort"),
    supabase.from("ticket_categories").select("id, name_ar").order("sort"),
  ]);
  const tickets = (data ?? []) as TicketRow[];
  const all = counts ?? [];
  const open = all.filter((t) => OPEN_STATUSES.includes(t.status));
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/maintenance?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="الصيانة" subtitle="بلاغات الصيانة ومتابعتها لحد ما تتقفل">
        {profile.role !== "technician" && <Link href="/maintenance/new" className="btn-primary">+ بلاغ جديد</Link>}
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="مفتوحة" value={open.length} />
        <Stat label="متأخرة عن الموعد" value={all.filter((t) => t.overdue).length} tone={all.some((t) => t.overdue) ? "red" : undefined} />
        <Stat label="مستني قطع غيار" value={all.filter((t) => t.status === "waiting_parts").length} />
        <Stat label="مستني تأكيد المشرف" value={all.filter((t) => t.status === "resolved").length} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link key={t.key} href={href({ tab: t.key })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap gap-2" action="/maintenance">
        <input type="hidden" name="tab" value={tab} />
        <select name="branch" defaultValue={sp.branch ?? ""} className="input w-auto">
          <option value="">كل الفروع</option>
          {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
        </select>
        <select name="cat" defaultValue={sp.cat ?? ""} className="input w-auto">
          <option value="">كل الأنواع</option>
          {(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="بحث في العنوان" className="input w-48" />
        <button className="btn-ghost">تصفية</button>
      </form>

      {tickets.length === 0 ? <Empty>مفيش بلاغات هنا 👌</Empty> : (
        <div className="card divide-y divide-slate-100">
          {tickets.map((t) => {
            const due = dueLabel(t);
            return (
              <Link key={t.id} href={`/maintenance/${t.id}`} className="flex flex-col gap-1 p-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">#{t.id}</span>
                    <span className="font-semibold">{t.title}</span>
                    {t.stops_branch && OPEN_STATUSES.includes(t.status) && <Badge tone="red">الفرع متوقف</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {t.branch_ar} · {t.category_ar ?? "عام"} · {timeAgo(t.created_at)}
                    {t.assignee_display && <> · الفني: {t.assignee_display}</>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {t.priority !== "normal" && <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>}
                  <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
                  {due && <span className={`text-xs font-semibold ${t.overdue ? "text-red-600" : "text-slate-500"}`}>{due}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
