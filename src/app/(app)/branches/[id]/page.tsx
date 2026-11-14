import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { dayLabel, formatDaysOff, formatShifts, formatTime, riyadhWeekday, STATUS_LABELS } from "@/lib/format";
import type { WorkerRow } from "@/lib/types";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

type Hours = { weekday: number; open_time: string | null; close_time: string | null; is_24h: boolean; is_closed: boolean };

function hoursSummary(hours: Hours[]): string[] {
  if (hours.length === 0) return ["—"];
  const fmt = (h: Hours) => (h.is_24h ? "24 ساعة" : h.is_closed ? "مقفول" : `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`);
  const groups = new Map<string, number[]>();
  for (const h of hours) groups.set(fmt(h), [...(groups.get(fmt(h)) ?? []), h.weekday]);
  if (groups.size === 1) return [`يومياً: ${[...groups.keys()][0]}`];
  return [...groups.entries()].map(([t, days]) => `${days.length >= 5 ? "باقي الأيام" : days.map(dayLabel).join("، ")}: ${t}`);
}

export default async function BranchPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, profile } = await requireActive();

  const [{ data: branch }, { data: hours }, { data: workers }] = await Promise.all([
    supabase.from("branches").select("*, cities(name_ar)").eq("id", id).maybeSingle(),
    supabase.from("branch_hours").select("*").eq("branch_id", id).order("weekday"),
    supabase.from("v_workers_current").select("*").eq("branch_id", id).order("full_name"),
  ]);
  if (!branch) notFound();
  const list = (workers ?? []) as WorkerRow[];
  const isAdmin = profile.role === "admin";
  const today = riyadhWeekday();
  const active = list.filter((w) => w.status === "active");
  const offToday = active.filter((w) => w.off_today).length;

  return (
    <>
      <PageHeader
        title={branch.name_ar}
        subtitle={<span>{(branch.cities as { name_ar: string } | null)?.name_ar} · <span dir="ltr">{branch.name_en}</span></span>}
        back={{ href: "/", label: "الفروع" }}
      >
        {branch.map_url && <a href={branch.map_url} target="_blank" rel="noreferrer" className="btn-ghost">📍 الخريطة</a>}
        {isAdmin && <Link href={`/workers/new?branch=${id}`} className="btn-primary">+ إضافة عامل</Link>}
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="عدد العمال" value={list.filter((w) => w.status !== "terminated").length} />
        <Stat label={`شغالين النهارده (${dayLabel(today)})`} value={active.length - offToday} />
        <Stat label="إجازة أسبوعية النهارده" value={offToday} />
        <Stat label="بيانات ناقصة" value={list.filter((w) => w.incomplete).length} tone={list.some((w) => w.incomplete) ? "amber" : undefined} />
      </div>

      <div className="card mb-4 grid gap-3 p-4 text-sm sm:grid-cols-2">
        <div>
          <div className="font-semibold text-slate-500">ساعات العمل</div>
          {hoursSummary((hours ?? []) as Hours[]).map((l) => <div key={l}>{l}</div>)}
          {branch.hours_note && <div className="mt-1 text-amber-700">{branch.hours_note}</div>}
        </div>
        <div>
          <div className="font-semibold text-slate-500">التنظيف العميق والصيانة الوقائية (PPM)</div>
          <div>{branch.ppm_weekday !== null ? `${dayLabel(branch.ppm_weekday)} الساعة ${formatTime(branch.ppm_time)}` : "غير محدد"}</div>
          {branch.phone && <div className="mt-1">التواصل: <span dir="ltr">{branch.phone}</span></div>}
        </div>
      </div>

      {list.length === 0 ? (
        <Empty>مفيش عمال في الفرع ده.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-right text-xs font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">الوظيفة</th>
                <th className="px-4 py-3">الدوام</th>
                <th className="px-4 py-3">الإجازة الأسبوعية</th>
                <th className="px-4 py-3">السكن</th>
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <Link href={`/workers/${w.id}`} className="font-semibold text-brand-700 hover:underline">{w.full_name}</Link>
                    ) : (
                      <span className="font-semibold">{w.full_name}</span>
                    )}
                    {(w.alt_name || w.emp_no) && (
                      <div className="text-xs text-slate-400">{[w.alt_name, w.emp_no].filter(Boolean).join(" · ")}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{w.job_title_ar ?? <span className="text-amber-700">غير محددة</span>}</td>
                  <td className="px-4 py-3">
                    {w.shifts.length ? formatShifts(w.shifts) : <span className="text-amber-700">غير محدد</span>}
                  </td>
                  <td className="px-4 py-3">
                    {!w.no_day_off && w.days_off.length === 0 ? <span className="text-amber-700">غير محددة</span> : formatDaysOff(w.days_off, w.no_day_off)}
                    {w.off_today && w.status === "active" && <span className="ms-2"><Badge tone="amber">إجازة النهارده</Badge></span>}
                  </td>
                  <td className="px-4 py-3">{w.housing_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={w.status === "active" ? "green" : w.status === "on_leave" ? "blue" : "gray"}>{STATUS_LABELS[w.status]}</Badge>
                    {w.notes && <div className="mt-1 text-xs text-slate-500">{w.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
