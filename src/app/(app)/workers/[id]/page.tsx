import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { DOC_LABELS, formatDate, formatDaysOff, formatShifts, STATUS_LABELS } from "@/lib/format";
import type { WorkerRow } from "@/lib/types";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { InfoFields, ScheduleFields } from "@/components/WorkerFields";
import { Badge, ExpiryBadge, Field, PageHeader } from "@/components/ui";
import { saveDocument, saveSchedule, transferWorker, updateWorkerInfo } from "../actions";

export const dynamic = "force-dynamic";

const DOC_TYPES = ["iqama", "passport", "insurance", "contract", "baladiya", "medical"] as const;

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase } = await requireAdmin();
  const [{ data: w }, { data: history }, { data: docs }, { data: branches }, { data: jobs }, { data: housings }] = await Promise.all([
    supabase.from("v_workers_current").select("*").eq("id", id).maybeSingle(),
    supabase.from("worker_assignments").select("id, start_date, end_date, note, branches(name_ar), job_titles(name_ar)").eq("worker_id", id).order("start_date", { ascending: false }),
    supabase.from("worker_documents").select("*").eq("worker_id", id),
    supabase.from("branches").select("id, name_ar, cities(name_ar)").order("city_id").order("sort"),
    supabase.from("job_titles").select("id, name_ar").order("sort"),
    supabase.from("housings").select("id, name").order("name"),
  ]);
  if (!w) notFound();
  const worker = w as WorkerRow & Record<string, never>;
  const branch = (branches ?? []).find((b) => b.id === worker.branch_id);
  const docMap = new Map((docs ?? []).map((d) => [d.doc_type, d]));

  return (
    <>
      <PageHeader
        title={worker.full_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{worker.job_title_ar ?? "وظيفة غير محددة"} · {branch?.name_ar ?? "بدون فرع"}</span>
            <Badge tone={worker.status === "active" ? "green" : "blue"}>{STATUS_LABELS[worker.status]}</Badge>
            {worker.incomplete && <Badge tone="amber">بيانات ناقصة</Badge>}
          </span>
        }
        back={worker.branch_id ? { href: `/branches/${worker.branch_id}`, label: branch?.name_ar ?? "الفرع" } : { href: "/", label: "الفروع" }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-2 font-bold">البيانات الأساسية</h2>
            <ActionForm action={updateWorkerInfo.bind(null, id)} className="card grid gap-4 p-5 sm:grid-cols-2">
              <InfoFields w={worker} housings={housings ?? []} />
              <div className="sm:col-span-2"><SubmitButton>حفظ البيانات</SubmitButton></div>
            </ActionForm>
          </section>

          <section>
            <h2 className="mb-2 font-bold">الدوام والإجازة</h2>
            <p className="mb-2 text-sm text-slate-500">الحالي: {formatShifts(worker.shifts)} · إجازة: {formatDaysOff(worker.days_off, worker.no_day_off)}</p>
            <ActionForm action={saveSchedule.bind(null, id)} className="card grid gap-4 p-5 sm:grid-cols-2">
              <ScheduleFields shifts={worker.shifts} daysOff={worker.days_off} noDayOff={worker.no_day_off} breakTime={worker.break_time} />
              <div className="sm:col-span-2"><SubmitButton>حفظ الدوام</SubmitButton></div>
            </ActionForm>
          </section>

          <section>
            <h2 className="mb-2 font-bold">المستندات</h2>
            <div className="space-y-3">
              {DOC_TYPES.map((t) => {
                const d = docMap.get(t);
                return (
                  <details key={t} className="card p-4">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{DOC_LABELS[t]}</span>
                      <span className="flex items-center gap-2 text-sm">
                        {d ? <>{d.expiry_date && <span className="text-slate-500">{formatDate(d.expiry_date)}</span>}<ExpiryBadge date={d.expiry_date} /></> : <Badge>غير مسجل</Badge>}
                      </span>
                    </summary>
                    <ActionForm action={saveDocument.bind(null, id, t)} className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Field label="الرقم"><input name="number" defaultValue={d?.number ?? ""} className="input" dir="ltr" /></Field>
                      <Field label={t === "insurance" ? "شركة التأمين" : "جهة الإصدار"}><input name="issuer" defaultValue={d?.issuer ?? ""} className="input" /></Field>
                      <Field label="تاريخ الانتهاء"><input name="expiry_date" type="date" defaultValue={d?.expiry_date ?? ""} className="input" /></Field>
                      <Field label="ملاحظات" className="sm:col-span-3"><input name="notes" defaultValue={d?.notes ?? ""} className="input" /></Field>
                      <div><SubmitButton className="btn-ghost">حفظ</SubmitButton></div>
                    </ActionForm>
                  </details>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-bold">نقل / تغيير الوظيفة</h2>
            <ActionForm action={transferWorker.bind(null, id)} className="card grid gap-3 p-5">
              <Field label="الفرع">
                <select name="branch_id" defaultValue={worker.branch_id ?? ""} className="input" required>
                  {(branches ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{(b.cities as unknown as { name_ar: string } | null)?.name_ar} — {b.name_ar}</option>
                  ))}
                </select>
              </Field>
              <Field label="الوظيفة">
                <select name="job_title_id" defaultValue={worker.job_title_id ?? ""} className="input">
                  <option value="">غير محددة</option>
                  {(jobs ?? []).map((j) => <option key={j.id} value={j.id}>{j.name_ar}</option>)}
                </select>
              </Field>
              <Field label="اعتباراً من"><input name="start_date" type="date" className="input" /></Field>
              <Field label="السبب / ملاحظة"><input name="note" className="input" placeholder="مثال: نقل لتغطية عجز" /></Field>
              <SubmitButton>تسجيل</SubmitButton>
            </ActionForm>
          </section>

          <section>
            <h2 className="mb-2 font-bold">السجل</h2>
            <ol className="card divide-y divide-slate-100 text-sm">
              {(history ?? []).map((h) => (
                <li key={h.id} className="p-3">
                  <div className="font-semibold">
                    {(h.branches as unknown as { name_ar: string } | null)?.name_ar} · {(h.job_titles as unknown as { name_ar: string } | null)?.name_ar ?? "وظيفة غير محددة"}
                  </div>
                  <div className="text-xs text-slate-500">
                    من {formatDate(h.start_date)} {h.end_date ? `إلى ${formatDate(h.end_date)}` : "— حتى الآن"}
                  </div>
                  {h.note && <div className="text-xs text-slate-500">{h.note}</div>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
