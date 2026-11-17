import Link from "next/link";
import { ChevronDownIcon, PackageIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { nf } from "@/lib/i18n/format";
import { CORE_FILE_KINDS, fileState } from "@/lib/branch";
import type { BranchSummary } from "@/lib/types";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyNote, PageHeader } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { createBranch } from "./actions";

export const dynamic = "force-dynamic";

export default async function BranchesPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { supabase, profile } = await requireActive();
  const { t, locale } = await getT();
  const B = t.branchesTab;
  const n = nf(locale);
  const isAdmin = profile.role === "admin";
  const [{ data: bData }, { data: eq }, { data: files }, { data: cities }] = await Promise.all([
    supabase.from("v_branch_summary").select("*").order("city_sort").order("sort"),
    supabase.from("equipment").select("branch_id, status"),
    supabase.from("branch_files").select("branch_id, kind, expiry_date"),
    supabase.from("cities").select("id, name_ar, name_en").order("sort"),
  ]);
  const branches = (bData ?? []) as BranchSummary[];
  const cityList = [...new Map(branches.map((b) => [b.city_en, b])).keys()];
  const sp = await searchParams;
  const city = sp.city && cityList.includes(sp.city) ? sp.city : cityList[0];
  const shown = branches.filter((b) => b.city_en === city);

  const stats = (id: number) => {
    const f = (files ?? []).filter((x) => x.branch_id === id);
    const st = f.map((x) => fileState(x.expiry_date));
    return {
      broken: (eq ?? []).filter((e) => e.branch_id === id && (e.status === "needs_repair" || e.status === "stopped")).length,
      expired: st.filter((s) => s === "expired").length,
      soon: st.filter((s) => s === "soon").length,
      missing: CORE_FILE_KINDS.filter((k) => !f.some((x) => x.kind === k)).length,
    };
  };

  return (
    <>
      <PageHeader title={B.title} sub={B.sub(n(branches.length))}>
        <Button variant="outline" render={<Link href="/branches/materials" />} nativeButton={false}><PackageIcon data-icon="inline-start" />{B.materialsList}</Button>
      </PageHeader>

      {isAdmin && (
        <details className="group rounded-2xl bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold md:px-5 [&::-webkit-details-marker]:hidden">
            {B.add}<ChevronDownIcon className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
          </summary>
          <ActionForm action={createBranch} className="grid gap-3 px-4 pb-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end md:px-5">
            <Field><FieldLabel htmlFor="nb-ar">{B.nameAr}</FieldLabel><Input id="nb-ar" name="name_ar" required dir="rtl" /></Field>
            <Field><FieldLabel htmlFor="nb-en">{B.nameEn}</FieldLabel><Input id="nb-en" name="name_en" required dir="ltr" /></Field>
            <Field>
              <FieldLabel htmlFor="nb-city">{B.city}</FieldLabel>
              <NativeSelect id="nb-city" name="city_id" required className="w-full">
                {(cities ?? []).map((c) => <NativeSelectOption key={c.id} value={c.id}>{pick(locale, c.name_ar, c.name_en)}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <SubmitButton>{B.create}</SubmitButton>
          </ActionForm>
        </details>
      )}

      {cityList.length > 1 && (
        <div role="tablist" aria-label={B.title} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-surface p-1">
          {cityList.map((c) => (
            <Link key={c} role="tab" aria-selected={c === city} href={`/branches?city=${encodeURIComponent(c)}`} scroll={false}
              className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150", c === city ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink")}>
              {t.cities[c] ?? c} <span className="num opacity-75">{n(branches.filter((b) => b.city_en === c).length)}</span>
            </Link>
          ))}
        </div>
      )}

      {shown.length === 0 ? <EmptyNote>{t.dashboard.noBranches}</EmptyNote> : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((b) => {
            const s = stats(b.id);
            const flags = [
              b.overdue_tickets > 0 && <Badge key="o" variant="danger">{t.dashboard.overdueN(n(b.overdue_tickets))}</Badge>,
              s.broken > 0 && <Badge key="b" variant="warning">{B.card.broken(n(s.broken))}</Badge>,
              s.expired > 0 && <Badge key="e" variant="danger">{B.card.filesExpired(n(s.expired))}</Badge>,
              s.soon > 0 && <Badge key="s" variant="warning">{B.card.filesDue(n(s.soon))}</Badge>,
              isAdmin && s.missing > 0 && <Badge key="m" variant="neutral">{B.card.filesMissing(n(s.missing))}</Badge>,
            ].filter(Boolean);
            return (
              <li key={b.id}>
                <Link href={`/branches/${b.id}`} className="flex h-full flex-col gap-3 rounded-2xl bg-surface p-4 transition-colors duration-150 hover:bg-surface-sunken md:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-[17px] font-semibold">{pick(locale, b.name_ar, b.name_en)}</h2>
                      <p className="truncate text-[13px] text-ink-muted" lang={locale === "ar" ? "en" : "ar"}>{locale === "ar" ? b.name_en : b.name_ar}</p>
                    </div>
                    {(b.stopped || b.status !== "active") && <Badge variant="danger">{b.stopped ? t.dashboard.stopped : B.status[b.status]}</Badge>}
                  </div>
                  <div className="flex gap-6">
                    <span className="flex items-baseline gap-1.5 text-[13px] text-ink-muted"><span className="num text-[22px] font-semibold text-ink">{n(b.workers_total)}</span>{t.dashboard.workers}</span>
                    <span className="flex items-baseline gap-1.5 text-[13px] text-ink-muted"><span className="num text-[22px] font-semibold text-ink">{n(b.open_tickets)}</span>{t.dashboard.openTickets}</span>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5">{flags.length ? flags : <Badge variant="success">{B.card.allGood}</Badge>}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
