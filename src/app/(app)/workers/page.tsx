import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusIcon, SearchIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { nf } from "@/lib/i18n/format";
import type { WorkerRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyNote, PageHeader, Panel } from "@/components/app/blocks";
import { WorkersTable } from "@/components/app/WorkersTable";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SHOWS = ["all", "working", "off", "leave", "incomplete", "nohousing"] as const;
type SP = { show?: string; branch?: string; q?: string };

export default async function WorkersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireActive();
  if (!["admin", "supervisor"].includes(profile.role)) redirect("/maintenance");
  const { t, locale } = await getT();
  const W = t.workersPage;
  const n = nf(locale);
  const show = (SHOWS as readonly string[]).includes(sp.show ?? "") ? sp.show! : "all";
  const isAdmin = profile.role === "admin";

  const [{ data: workers }, { data: branches }] = await Promise.all([
    supabase.from("v_workers_current").select("*").neq("status", "terminated").order("full_name"),
    supabase.from("branches").select("id, name_ar, name_en").order("city_id").order("sort"),
  ]);
  const bMap = new Map((branches ?? []).map((b) => [b.id, { id: b.id, name: pick(locale, b.name_ar, b.name_en) }]));
  const everyone = ((workers ?? []) as WorkerRow[]).filter((w) => !sp.branch || w.branch_id === Number(sp.branch));
  const is: Record<string, (w: WorkerRow) => boolean> = {
    all: () => true,
    working: (w) => w.status === "active" && !w.off_today,
    off: (w) => w.status === "active" && w.off_today,
    leave: (w) => w.status === "on_leave",
    incomplete: (w) => w.incomplete,
    nohousing: (w) => !w.housing_id,
  };
  const term = (sp.q ?? "").trim().toLowerCase();
  const list = everyone.filter(is[show]).filter((w) => !term || [w.full_name, w.alt_name, w.emp_no].some((x) => x?.toLowerCase().includes(term)));
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v && v !== "all") as [string, string][]);
    return `/workers?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title={W.title} sub={W.sub(n((workers ?? []).length), n(new Set((workers ?? []).map((w) => w.branch_id)).size))}>
        {isAdmin && <Button render={<Link href="/workers/new" />} nativeButton={false}><PlusIcon data-icon="inline-start" />{t.branch.addWorker}</Button>}
      </PageHeader>

      <Panel>
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label={W.title} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-canvas p-1">
            {SHOWS.filter((k) => isAdmin || (k !== "incomplete" && k !== "nohousing")).map((k) => (
              <Link key={k} role="tab" aria-selected={show === k} href={href({ show: k })} scroll={false}
                className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150", show === k ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink")}>
                {W.filters[k]} <span className="num opacity-75">{n(everyone.filter(is[k]).length)}</span>
              </Link>
            ))}
          </div>

          <form className="grid gap-2 sm:grid-cols-[1fr_1.6fr_auto]" action="/workers">
            {show !== "all" && <input type="hidden" name="show" value={show} />}
            <NativeSelect name="branch" defaultValue={sp.branch ?? ""} aria-label={W.branch} className="w-full">
              <NativeSelectOption value="">{W.allBranches}</NativeSelectOption>
              {(branches ?? []).map((b) => <NativeSelectOption key={b.id} value={b.id}>{pick(locale, b.name_ar, b.name_en)}</NativeSelectOption>)}
            </NativeSelect>
            <Input name="q" defaultValue={sp.q ?? ""} placeholder={W.search} aria-label={W.search} dir="auto" />
            <Button type="submit" variant="outline"><SearchIcon data-icon="inline-start" />{t.maintenance.apply}</Button>
          </form>

          {list.length === 0 ? <EmptyNote>{W.empty}</EmptyNote>
            : <WorkersTable t={t} locale={locale} workers={list} linkNames={isAdmin} branchName={(id) => (id ? bMap.get(id) ?? null : null)} />}
        </div>
      </Panel>
    </>
  );
}
