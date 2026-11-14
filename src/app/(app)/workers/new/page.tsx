import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { InfoFields, ScheduleFields } from "@/components/WorkerFields";
import { Field, PageHeader } from "@/components/ui";
import { createWorker } from "../actions";

export default async function NewWorkerPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const { branch } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: branches }, { data: jobs }, { data: housings }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, cities(name_ar)").order("city_id").order("sort"),
    supabase.from("job_titles").select("id, name_ar").order("sort"),
    supabase.from("housings").select("id, name").order("name"),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="إضافة عامل" back={branch ? { href: `/branches/${branch}`, label: "الفرع" } : { href: "/", label: "الفروع" }} />
      <ActionForm action={createWorker} className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="الفرع *">
          <select name="branch_id" defaultValue={branch ?? ""} className="input" required>
            <option value="" disabled>اختار الفرع</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>{(b.cities as unknown as { name_ar: string } | null)?.name_ar} — {b.name_ar}</option>
            ))}
          </select>
        </Field>
        <Field label="الوظيفة">
          <select name="job_title_id" className="input" defaultValue="">
            <option value="">غير محددة</option>
            {(jobs ?? []).map((j) => <option key={j.id} value={j.id}>{j.name_ar}</option>)}
          </select>
        </Field>
        <InfoFields housings={housings ?? []} />
        <div className="sm:col-span-2 border-t border-slate-100 pt-2 font-bold">الدوام</div>
        <ScheduleFields />
        <div className="sm:col-span-2"><SubmitButton>إضافة العامل</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
