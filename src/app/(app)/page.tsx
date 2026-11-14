import Link from "next/link";
import { requireActive } from "@/lib/auth";
import { dayLabel, riyadhWeekday } from "@/lib/format";
import type { BranchSummary } from "@/lib/types";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { supabase } = await requireActive();
  const { data, error } = await supabase
    .from("v_branch_summary")
    .select("*")
    .order("city_sort")
    .order("sort");
  if (error) throw error;
  const branches = (data ?? []) as BranchSummary[];

  const sum = (k: keyof BranchSummary) => branches.reduce((s, b) => s + Number(b[k] ?? 0), 0);
  const cities = [...new Map(branches.map((b) => [b.city_id, b.city_ar])).entries()];

  return (
    <>
      <PageHeader title="الفروع" subtitle={`النهارده ${dayLabel(riyadhWeekday())} · ${branches.length} فرع في ${cities.length} مدن`} />

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="إجمالي العمال" value={sum("workers_total")} />
        <Stat label="شغالين النهارده" value={sum("working_today")} />
        <Stat label="إجازة أسبوعية النهارده" value={sum("off_today")} />
        <Stat label="في إجازة طويلة" value={sum("on_leave")} />
        <Stat label="بيانات ناقصة" value={sum("incomplete")} tone={sum("incomplete") ? "amber" : undefined} />
      </div>

      {branches.length === 0 && <Empty>مفيش فروع متاحة ليك. لو إنت مشرف، اطلب من مدير التشغيل يربطك بفروعك.</Empty>}

      {cities.map(([cityId, cityName]) => {
        const list = branches.filter((b) => b.city_id === cityId);
        return (
          <section key={cityId} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              {cityName}
              <span className="text-sm font-semibold text-slate-400">
                {list.length} فرع · {list.reduce((s, b) => s + b.workers_total, 0)} عامل
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((b) => (
                <Link key={b.id} href={`/branches/${b.id}`}
                  className="card group flex flex-col p-5 transition hover:border-brand-500 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold group-hover:text-brand-700">{b.name_ar}</h3>
                      <p className="truncate text-sm text-slate-400" dir="ltr">{b.name_en}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-center rounded-xl bg-brand-50 px-4 py-2 text-brand-700">
                      <span className="text-3xl font-bold leading-none">{b.workers_total}</span>
                      <span className="mt-1 text-xs font-semibold">عامل</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                    <span>شغالين: <b>{b.working_today}</b></span>
                    <span>إجازة النهارده: <b>{b.off_today}</b></span>
                    {b.on_leave > 0 && <span>إجازة طويلة: <b>{b.on_leave}</b></span>}
                  </div>
                  {(b.incomplete > 0 || b.status !== "active") && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {b.status === "stopped" && <Badge tone="red">الفرع متوقف</Badge>}
                      {b.status === "closed" && <Badge tone="gray">مقفول</Badge>}
                      {b.incomplete > 0 && <Badge tone="amber">{b.incomplete} بيانات ناقصة</Badge>}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
