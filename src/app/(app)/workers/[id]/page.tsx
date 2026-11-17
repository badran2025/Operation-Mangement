import { notFound } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries";
import { daysUntil, formatDate, formatDaysOff, formatShifts, TZ } from "@/lib/i18n/format";
import type { WorkerRow } from "@/lib/types";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { InfoFields, ScheduleFields } from "@/components/WorkerFields";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader, Panel } from "@/components/app/blocks";
import { saveDocument, saveSchedule, transferWorker, updateWorkerInfo } from "../actions";

export const dynamic = "force-dynamic";

const DOC_TYPES = ["iqama", "passport", "insurance", "contract", "baladiya", "medical"] as const;

function ExpiryBadge({ t, date }: { t: Dict; date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <Badge variant="neutral">{t.worker.docNoDate}</Badge>;
  if (d < 0) return <Badge variant="danger">{t.time.expiredDays(-d)}</Badge>;
  if (d <= 30) return <Badge variant="danger">{t.time.daysLeft(d)}</Badge>;
  if (d <= 90) return <Badge variant="warning">{t.time.daysLeft(d)}</Badge>;
  return <Badge variant="success">{t.worker.validLeft(d)}</Badge>;
}

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const [{ data: w }, { data: history }, { data: docs }, { data: branches }, { data: jobs }, { data: housings }] = await Promise.all([
    supabase.from("v_workers_current").select("*").eq("id", id).maybeSingle(),
    supabase.from("worker_assignments").select("id, start_date, end_date, note, branches(name_ar, name_en), job_titles(name_ar, name_en)").eq("worker_id", id).order("start_date", { ascending: false }),
    supabase.from("worker_documents").select("*").eq("worker_id", id),
    supabase.from("branches").select("id, name_ar, name_en, cities(name_ar, name_en)").order("city_id").order("sort"),
    supabase.from("job_titles").select("id, name_ar, name_en").order("sort"),
    supabase.from("housings").select("id, name").order("name"),
  ]);
  if (!w) notFound();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const current = (history ?? []).find((h) => !h.end_date);
  const worker = w as WorkerRow & Record<string, never>;
  const branch = (branches ?? []).find((b) => b.id === worker.branch_id);
  const docMap = new Map((docs ?? []).map((d) => [d.doc_type, d]));
  type NameAr = { name_ar: string; name_en: string } | null;

  return (
    <>
      <PageHeader
        back={worker.branch_id ? { href: `/branches/${worker.branch_id}`, label: pick(locale, branch?.name_ar, branch?.name_en) } : { href: "/", label: t.nav.overview }}
        title={worker.full_name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span>{worker.job_title_ar ? pick(locale, worker.job_title_ar, worker.job_title_en) : t.worker.roleNotSet}</span>
            <Badge variant={worker.status === "active" ? "success" : worker.status === "on_leave" ? "info" : "neutral"}>{t.worker.status[worker.status]}</Badge>
            {worker.incomplete && <Badge variant="warning">{t.dashboard.incomplete}</Badge>}
          </span>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={t.worker.basics}>
            <ActionForm action={updateWorkerInfo.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
              <InfoFields t={t} w={worker} housings={housings ?? []} />
              <div className="sm:col-span-2"><SubmitButton>{t.worker.saveDetails}</SubmitButton></div>
            </ActionForm>
          </Panel>

          <Panel title={t.worker.schedule}>
            <p className="-mt-1 mb-4 text-sm text-ink-muted">
              {t.worker.current}: {formatShifts(t, worker.shifts)}{t.common.comma}{formatDaysOff(t, worker.days_off, worker.no_day_off)}
            </p>
            <ActionForm action={saveSchedule.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
              <ScheduleFields t={t} shifts={worker.shifts} daysOff={worker.days_off} noDayOff={worker.no_day_off} breakTime={worker.break_time} />
              <div className="sm:col-span-2"><SubmitButton>{t.worker.saveSchedule}</SubmitButton></div>
            </ActionForm>
          </Panel>

          <Panel title={t.worker.documents}>
            <div className="flex flex-col gap-2">
              {DOC_TYPES.map((dt) => {
                const d = docMap.get(dt);
                return (
                  <details key={dt} className="group rounded-[14px] bg-canvas">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="font-semibold">{t.worker.docTypes[dt]}</span>
                      <span className="flex items-center gap-2 text-sm">
                        {d ? <>{d.expiry_date && <span className="num text-ink-muted">{formatDate(locale, d.expiry_date)}</span>}<ExpiryBadge t={t} date={d.expiry_date} /></> : <Badge variant="neutral">{t.worker.docNotRecorded}</Badge>}
                        <ChevronDownIcon className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
                      </span>
                    </summary>
                    <ActionForm action={saveDocument.bind(null, id, dt)} className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
                      <Field><FieldLabel htmlFor={`${dt}-number`}>{t.worker.docNumber}</FieldLabel><Input id={`${dt}-number`} name="number" defaultValue={d?.number ?? ""} dir="ltr" /></Field>
                      <Field><FieldLabel htmlFor={`${dt}-issuer`}>{dt === "insurance" ? t.worker.docInsurer : t.worker.docIssuer}</FieldLabel><Input id={`${dt}-issuer`} name="issuer" defaultValue={d?.issuer ?? ""} dir="auto" /></Field>
                      <Field><FieldLabel htmlFor={`${dt}-expiry`}>{t.worker.docExpiry}</FieldLabel><Input id={`${dt}-expiry`} name="expiry_date" type="date" defaultValue={d?.expiry_date ?? ""} /></Field>
                      <Field className="sm:col-span-3"><FieldLabel htmlFor={`${dt}-notes`}>{t.common.notes}</FieldLabel><Input id={`${dt}-notes`} name="notes" defaultValue={d?.notes ?? ""} dir="auto" /></Field>
                      <div><SubmitButton variant="outline">{t.common.save}</SubmitButton></div>
                    </ActionForm>
                  </details>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={t.worker.transfer}>
            <ActionForm action={transferWorker.bind(null, id)} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="t-branch">{t.worker.branch}</FieldLabel>
                <NativeSelect id="t-branch" name="branch_id" defaultValue={worker.branch_id ?? ""} required className="w-full">
                  {(branches ?? []).map((b) => {
                    const c = b.cities as unknown as NameAr;
                    return <NativeSelectOption key={b.id} value={b.id}>{pick(locale, c?.name_ar, c?.name_en)}: {pick(locale, b.name_ar, b.name_en)}</NativeSelectOption>;
                  })}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="t-job">{t.worker.role}</FieldLabel>
                <NativeSelect id="t-job" name="job_title_id" defaultValue={worker.job_title_id ?? ""} className="w-full">
                  <NativeSelectOption value="">{t.worker.roleNotSet}</NativeSelectOption>
                  {(jobs ?? []).map((j) => <NativeSelectOption key={j.id} value={j.id}>{pick(locale, j.name_ar, j.name_en)}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field><FieldLabel htmlFor="t-from">{t.worker.from}</FieldLabel><Input id="t-from" name="start_date" type="date" max={today} min={current?.start_date ?? undefined} /></Field>
              <Field><FieldLabel htmlFor="t-note">{t.worker.reason}</FieldLabel><Input id="t-note" name="note" placeholder={t.worker.reasonPh} dir="auto" /></Field>
              <SubmitButton>{t.worker.record}</SubmitButton>
            </ActionForm>
          </Panel>

          <Panel title={t.worker.history}>
            <ol className="relative flex flex-col gap-3 border-s-2 border-hairline ps-4">
              {(history ?? []).map((h) => {
                const b = h.branches as unknown as NameAr, j = h.job_titles as unknown as NameAr;
                return (
                  <li key={h.id} className="relative">
                    <span className={`absolute -start-[23px] top-1.5 size-3 rounded-full ring-4 ring-surface ${h.end_date ? "bg-hairline" : "bg-primary"}`} aria-hidden />
                    <div className="font-semibold">{pick(locale, b?.name_ar, b?.name_en)}{t.common.comma}{j ? pick(locale, j.name_ar, j.name_en) : t.worker.roleNotSet}</div>
                    <div className="num text-[13px] text-ink-muted">{formatDate(locale, h.start_date)} – {h.end_date ? formatDate(locale, h.end_date) : t.worker.toNow}</div>
                    {h.note && <div className="text-[13px] text-ink-muted" dir="auto">{h.note}</div>}
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
