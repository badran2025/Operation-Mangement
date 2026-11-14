import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { InfoFields, ScheduleFields } from "@/components/WorkerFields";
import { Field, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader, Panel } from "@/components/app/blocks";
import { createWorker } from "../actions";

export default async function NewWorkerPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const { branch } = await searchParams;
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const [{ data: branches }, { data: jobs }, { data: housings }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en, cities(name_ar, name_en)").order("city_id").order("sort"),
    supabase.from("job_titles").select("id, name_ar, name_en").order("sort"),
    supabase.from("housings").select("id, name").order("name"),
  ]);
  type NameAr = { name_ar: string; name_en: string } | null;
  const current = (branches ?? []).find((b) => String(b.id) === branch);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={t.worker.newWorker} back={current ? { href: `/branches/${current.id}`, label: pick(locale, current.name_ar, current.name_en) } : { href: "/", label: t.nav.overview }} />
      <Panel className="mt-6">
        <ActionForm action={createWorker} className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="n-branch">{t.worker.branch} *</FieldLabel>
            <NativeSelect id="n-branch" name="branch_id" defaultValue={branch ?? ""} required className="w-full">
              <NativeSelectOption value="" disabled>{t.worker.branchRequired}</NativeSelectOption>
              {(branches ?? []).map((b) => {
                const c = b.cities as unknown as NameAr;
                return <NativeSelectOption key={b.id} value={b.id}>{pick(locale, c?.name_ar, c?.name_en)}: {pick(locale, b.name_ar, b.name_en)}</NativeSelectOption>;
              })}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="n-job">{t.worker.role}</FieldLabel>
            <NativeSelect id="n-job" name="job_title_id" defaultValue="" className="w-full">
              <NativeSelectOption value="">{t.worker.roleNotSet}</NativeSelectOption>
              {(jobs ?? []).map((j) => <NativeSelectOption key={j.id} value={j.id}>{pick(locale, j.name_ar, j.name_en)}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <InfoFields t={t} housings={housings ?? []} />
          <FieldSeparator className="sm:col-span-2">{t.worker.schedule}</FieldSeparator>
          <ScheduleFields t={t} />
          <div className="sm:col-span-2"><SubmitButton>{t.worker.create}</SubmitButton></div>
        </ActionForm>
      </Panel>
    </div>
  );
}
