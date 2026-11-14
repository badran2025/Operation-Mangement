import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteBranch } from "@/lib/actions";
import { dayLabel, daysOffLabel, formatTime, isOffOn, todayDay } from "@/lib/days";
import { PageHeader } from "@/components/PageHeader";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function BranchPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const branch = await db.branch.findUnique({
    where: { id },
    include: { workers: { orderBy: { name: "asc" }, include: { housing: true } } },
  });
  if (!branch) notFound();

  const today = todayDay();
  const offToday = branch.workers.filter((w) => isOffOn(w.daysOff, today)).length;

  return (
    <>
      <PageHeader
        title={branch.name}
        subtitle={[branch.address, branch.supervisor && `المشرف: ${branch.supervisor}`, branch.phone].filter(Boolean).join(" · ")}
        back={{ href: "/", label: "الفروع" }}
      >
        <Link href={`/branches/${id}/workers/new`} className="btn-primary">+ إضافة عامل</Link>
        <Link href={`/branches/${id}/edit`} className="btn-ghost">تعديل الفرع</Link>
        <DeleteButton
          action={deleteBranch.bind(null, id)}
          confirmText={`متأكد إنك عايز تحذف فرع "${branch.name}"؟ هيتحذف معاه كل العمال المسجلين فيه (${branch.workers.length}).`}
          label="حذف الفرع"
        />
      </PageHeader>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="card p-4"><div className="text-xs font-semibold text-slate-500">عدد العمال</div><div className="text-2xl font-bold">{branch.workers.length}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold text-slate-500">إجازة النهارده ({dayLabel(today)})</div><div className="text-2xl font-bold">{offToday}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold text-slate-500">شغالين النهارده</div><div className="text-2xl font-bold">{branch.workers.length - offToday}</div></div>
      </div>

      {branch.notes && <div className="card mb-4 p-4 text-sm text-slate-600 whitespace-pre-line">{branch.notes}</div>}

      {branch.workers.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">مفيش عمال في الفرع ده لسه.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-right text-xs font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">الوظيفة</th>
                <th className="px-4 py-3">الدوام</th>
                <th className="px-4 py-3">الإجازة الأسبوعية</th>
                <th className="px-4 py-3">السكن</th>
                <th className="px-4 py-3">الجوال</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branch.workers.map((w) => {
                const off = isOffOn(w.daysOff, today);
                return (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{w.name}</div>
                      {w.code && <div className="text-xs text-slate-400">#{w.code}</div>}
                    </td>
                    <td className="px-4 py-3">{w.jobTitle ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">من {formatTime(w.shiftStart)} إلى {formatTime(w.shiftEnd)}</td>
                    <td className="px-4 py-3">
                      {daysOffLabel(w.daysOff)}
                      {off && <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">إجازة النهارده</span>}
                    </td>
                    <td className="px-4 py-3">{w.housing?.name ?? "—"}</td>
                    <td className="px-4 py-3" dir="ltr">{w.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-left">
                      <Link href={`/workers/${w.id}/edit`} className="font-semibold text-brand-700 hover:underline">تعديل</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
