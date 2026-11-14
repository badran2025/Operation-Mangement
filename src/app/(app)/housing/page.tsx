import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { Badge, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HousingPage() {
  const { supabase, profile } = await requireActive();
  if (!["admin", "supervisor"].includes(profile.role)) redirect("/");
  const [{ data: housings }, { data: workers }] = await Promise.all([
    supabase.from("housings").select("*").order("name"),
    supabase.from("v_workers_current").select("id, full_name, housing_id, branch_id, status").neq("status", "terminated"),
  ]);
  const { data: branches } = await supabase.from("branches").select("id, name_ar");
  const bName = new Map((branches ?? []).map((b) => [b.id, b.name_ar]));
  const list = workers ?? [];
  const noHousing = list.filter((w) => !w.housing_id).length;

  return (
    <>
      <PageHeader title="السكن" subtitle="عدد العمال في كل سكن وتوزيعهم على الفروع" />
      {noHousing > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {noHousing} عامل لسه مش متسجل لهم سكن.
        </div>
      )}
      {(housings ?? []).length === 0 ? <Empty>مفيش سكنات متسجلة.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(housings ?? []).map((h) => {
            const residents = list.filter((w) => w.housing_id === h.id);
            const byBranch = new Map<number, number>();
            residents.forEach((w) => w.branch_id && byBranch.set(w.branch_id, (byBranch.get(w.branch_id) ?? 0) + 1));
            return (
              <div key={h.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{h.name}</h2>
                    {h.address && <p className="truncate text-sm text-slate-500">{h.address}</p>}
                    {h.capacity && <Badge tone={residents.length > h.capacity ? "red" : "gray"}>السعة {h.capacity}</Badge>}
                  </div>
                  <div className="flex shrink-0 flex-col items-center rounded-xl bg-brand-50 px-4 py-2 text-brand-700">
                    <span className="text-3xl font-bold leading-none">{residents.length}</span>
                    <span className="mt-1 text-xs font-semibold">ساكن</span>
                  </div>
                </div>
                {byBranch.size > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                    {[...byBranch.entries()].map(([bid, n]) => (
                      <li key={bid} className="flex justify-between">
                        <Link href={`/branches/${bid}`} className="hover:text-brand-700 hover:underline">{bName.get(bid)}</Link><b>{n}</b>
                      </li>
                    ))}
                  </ul>
                )}
                {h.map_url && <a href={h.map_url} target="_blank" rel="noreferrer" className="mt-3 text-sm font-semibold text-brand-700 hover:underline">📍 الخريطة</a>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
