import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function HousingPage() {
  const [housings, noHousing] = await Promise.all([
    db.housing.findMany({
      orderBy: { name: "asc" },
      include: { workers: { select: { branch: { select: { id: true, name: true } } } } },
    }),
    db.worker.count({ where: { housingId: null } }),
  ]);

  return (
    <>
      <PageHeader title="أماكن السكن" subtitle="السكنات وعدد العمال في كل سكن وتوزيعهم على الفروع">
        <Link href="/housing/new" className="btn-primary">+ إضافة سكن</Link>
      </PageHeader>

      {noHousing > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          في {noHousing} عامل مش متسجل لهم سكن.
        </div>
      )}

      {housings.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">مفيش سكنات متسجلة لسه.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {housings.map((h) => {
            const byBranch = new Map<number, { name: string; count: number }>();
            for (const w of h.workers) {
              const cur = byBranch.get(w.branch.id) ?? { name: w.branch.name, count: 0 };
              cur.count++;
              byBranch.set(w.branch.id, cur);
            }
            return (
              <div key={h.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{h.name}</h2>
                    {h.address && <p className="truncate text-sm text-slate-500">{h.address}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-center rounded-xl bg-brand-50 px-4 py-2 text-brand-700">
                    <span className="text-3xl font-bold leading-none">{h.workers.length}</span>
                    <span className="mt-1 text-xs font-semibold">عامل</span>
                  </div>
                </div>
                {byBranch.size > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                    {[...byBranch.entries()].map(([bid, v]) => (
                      <li key={bid} className="flex justify-between">
                        <Link href={`/branches/${bid}`} className="hover:text-brand-700 hover:underline">{v.name}</Link>
                        <b>{v.count}</b>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto pt-3">
                  <Link href={`/housing/${h.id}/edit`} className="text-sm font-semibold text-brand-700 hover:underline">تعديل</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
