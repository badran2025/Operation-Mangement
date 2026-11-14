import Link from "next/link";
import { db } from "@/lib/db";
import { dayLabel, isOffOn, todayDay } from "@/lib/days";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = todayDay();
  const branches = await db.branch.findMany({
    orderBy: { name: "asc" },
    include: { workers: { select: { daysOff: true } } },
  });

  const totalWorkers = branches.reduce((s, b) => s + b.workers.length, 0);
  const offToday = branches.reduce((s, b) => s + b.workers.filter((w) => isOffOn(w.daysOff, today)).length, 0);

  const stats = [
    { label: "عدد الفروع", value: branches.length },
    { label: "إجمالي العمال", value: totalWorkers },
    { label: `في إجازة النهارده (${dayLabel(today)})`, value: offToday },
    { label: "شغالين النهارده", value: totalWorkers - offToday },
  ];

  return (
    <>
      <PageHeader title="الفروع" subtitle="كل فروع الشركة وعدد العمال في كل فرع">
        <Link href="/branches/new" className="btn-primary">+ إضافة فرع</Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-xs font-semibold text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {branches.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          لسه مفيش فروع. ابدأ بـ <Link href="/branches/new" className="font-semibold text-brand-700 underline">إضافة أول فرع</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => {
            const count = b.workers.length;
            const off = b.workers.filter((w) => isOffOn(w.daysOff, today)).length;
            return (
              <Link key={b.id} href={`/branches/${b.id}`} className="card group flex flex-col p-5 transition hover:border-brand-500 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold group-hover:text-brand-700">{b.name}</h2>
                    {b.address && <p className="truncate text-sm text-slate-500">{b.address}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-center rounded-xl bg-brand-50 px-4 py-2 text-brand-700">
                    <span className="text-3xl font-bold leading-none">{count}</span>
                    <span className="mt-1 text-xs font-semibold">عامل</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  <span>المشرف: {b.supervisor ?? "—"}</span>
                  <span>إجازة النهارده: <b>{off}</b></span>
                  <span>شغالين: <b>{count - off}</b></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
