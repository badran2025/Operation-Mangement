import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { daysUntil, DOC_LABELS, formatDate } from "@/lib/format";
import { Empty, ExpiryBadge, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("worker_documents")
    .select("id, doc_type, number, expiry_date, worker_id, workers(full_name)")
    .not("expiry_date", "is", null)
    .order("expiry_date");
  const docs = (data ?? []).map((d) => ({ ...d, days: daysUntil(d.expiry_date)! }));
  const expired = docs.filter((d) => d.days < 0);
  const soon = docs.filter((d) => d.days >= 0 && d.days <= 30);
  const within90 = docs.filter((d) => d.days > 30 && d.days <= 90);
  const attention = docs.filter((d) => d.days <= 90);

  return (
    <>
      <PageHeader title="المستندات" subtitle="الإقامات والجوازات والتأمين والعقود اللي قربت تنتهي" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="منتهية" value={expired.length} tone={expired.length ? "red" : undefined} />
        <Stat label="خلال 30 يوم" value={soon.length} tone={soon.length ? "red" : undefined} />
        <Stat label="خلال 90 يوم" value={within90.length} tone={within90.length ? "amber" : undefined} />
        <Stat label="إجمالي المسجل" value={docs.length} />
      </div>
      {attention.length === 0 ? <Empty>مفيش مستندات هتنتهي خلال 90 يوم 👌</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50 text-right text-xs font-bold text-slate-500">
              <tr><th className="px-4 py-3">العامل</th><th className="px-4 py-3">المستند</th><th className="px-4 py-3">تاريخ الانتهاء</th><th className="px-4 py-3">الحالة</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attention.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3"><Link href={`/workers/${d.worker_id}`} className="font-semibold text-brand-700 hover:underline">{(d.workers as unknown as { full_name: string } | null)?.full_name}</Link></td>
                  <td className="px-4 py-3">{DOC_LABELS[d.doc_type]}</td>
                  <td className="px-4 py-3">{formatDate(d.expiry_date)}</td>
                  <td className="px-4 py-3"><ExpiryBadge date={d.expiry_date} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
