import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { daysUntil, dueInfo, greeting, nf, OPEN_STATUSES, todayLabel } from "@/lib/i18n/format";
import type { BranchSummary } from "@/lib/types";
import type { TicketRow } from "@/lib/tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyNote, Kpi, PageHeader, Panel, RowChevron, SoftRow } from "@/components/app/blocks";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "info" | "warning" | "success" | "danger" | "neutral"> = {
  new: "danger", assigned: "info", in_progress: "success", waiting_parts: "warning", resolved: "success", closed: "neutral", cancelled: "neutral",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { supabase, profile } = await requireActive();
  if (profile.role === "technician" || profile.role === "maintenance_manager") redirect("/maintenance");
  const { t, locale } = await getT();
  const n = nf(locale);
  const isAdmin = profile.role === "admin";

  const [{ data: bData }, { data: tData }, { data: dData }, { data: branchNames }] = await Promise.all([
    supabase.from("v_branch_summary").select("*").order("city_sort").order("sort"),
    supabase.from("v_tickets").select("*").in("status", OPEN_STATUSES).order("due_at").limit(6),
    isAdmin
      ? supabase.from("worker_documents").select("id, doc_type, expiry_date, worker_id, workers(full_name)").not("expiry_date", "is", null).order("expiry_date").limit(30)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("branches").select("id, name_en"),
  ]);
  const branches = (bData ?? []) as BranchSummary[];
  const tickets = (tData ?? []) as TicketRow[];
  const enName = new Map((branchNames ?? []).map((b) => [b.id, b.name_en]));
  const docs = (dData ?? []).map((d) => ({ ...d, days: daysUntil(d.expiry_date)! })).filter((d) => d.days <= 90);

  const sum = (k: keyof BranchSummary) => branches.reduce((s, b) => s + Number(b[k] ?? 0), 0);
  const cities = [...new Map(branches.map((b) => [b.city_en, b])).keys()];
  const sp = await searchParams;
  const city = sp.city && cities.includes(sp.city) ? sp.city : cities[0];
  const inCity = branches.filter((b) => b.city_en === city);
  const firstName = (profile.full_name || "").split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow={<span className="mb-2 inline-block rounded-full bg-brand-accent px-2.5 py-0.5 text-[12.5px] font-semibold text-[#3b2a00]">{todayLabel(locale)}</span>}
        title={`${greeting(t)}${firstName ? (locale === "ar" ? ` يا ${firstName}` : `, ${firstName}`) : ""}`}
        sub={t.dashboard.sub(branches.length)}
      >
        <Button render={<Link href="/maintenance/new" />} nativeButton={false}>
          <PlusIcon data-icon="inline-start" />{t.dashboard.newTicket}
        </Button>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label={t.nav.overview}>
        <Kpi label={t.dashboard.workers} value={n(sum("workers_total"))} highlight className="col-span-2 md:col-span-1" />
        <Kpi label={t.dashboard.workingToday} value={n(sum("working_today"))} />
        <Kpi label={t.dashboard.openTickets} value={n(sum("open_tickets"))} />
        <Kpi label={t.dashboard.overdue} value={n(sum("overdue_tickets"))} tone={sum("overdue_tickets") ? "danger" : undefined} />
        {isAdmin && <Kpi label={t.dashboard.docsExpiring} value={n(docs.length)} tone={docs.length ? "warning" : undefined} />}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          title={t.dashboard.branches}
          action={cities.length > 1 && (
            <div role="tablist" aria-label={t.dashboard.branches} className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-canvas p-1">
              {cities.map((c) => {
                const active = c === city;
                return (
                  <Link key={c} role="tab" aria-selected={active} href={`/?city=${encodeURIComponent(c)}`} scroll={false}
                    className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150", active ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink")}>
                    {t.cities[c] ?? c} <span className="num opacity-75">{n(branches.filter((b) => b.city_en === c).length)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        >
          {branches.length === 0 ? <EmptyNote>{t.dashboard.noBranches}</EmptyNote> : (
            <>
              <div className="flex gap-7 px-1 pb-3.5 pt-1 text-ink-muted">
                <span className="flex items-baseline gap-1.5"><span className="num text-[26px] font-semibold text-ink">{n(inCity.reduce((s, b) => s + b.workers_total, 0))}</span>{t.dashboard.workers}</span>
                <span className="flex items-baseline gap-1.5"><span className="num text-[26px] font-semibold text-ink">{n(inCity.reduce((s, b) => s + b.open_tickets, 0))}</span>{t.dashboard.openTickets}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {inCity.map((b) => (
                  <li key={b.id}>
                    <SoftRow href={`/branches/${b.id}`}>
                      <span className="min-w-0 flex-1 truncate font-semibold">{pick(locale, b.name_ar, b.name_en)}</span>
                      <span className="hidden text-[13px] text-ink-muted sm:inline">{t.dashboard.working(n(b.working_today))}</span>
                      {b.stopped ? <Badge variant="danger">{t.dashboard.stopped}</Badge>
                        : b.overdue_tickets > 0 ? <Badge variant="danger">{t.dashboard.overdueN(n(b.overdue_tickets))}</Badge>
                        : b.open_tickets > 0 ? <Badge variant="info">{t.dashboard.openN(n(b.open_tickets))}</Badge>
                        : <Badge variant="success">{t.dashboard.allClear}</Badge>}
                      <RowChevron />
                    </SoftRow>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={t.dashboard.queue} action={<Link href="/maintenance" className="text-sm font-medium text-primary hover:underline">{t.dashboard.allTickets}</Link>}>
            <ul className="flex flex-col gap-2">
              {tickets.map((k) => {
                const due = dueInfo(t, k.due_at, k.status);
                return (
                  <li key={k.id}>
                    <SoftRow href={`/maintenance/${k.id}`} className="flex-col items-stretch gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="user-text min-w-0 flex-1 truncate font-medium" dir="auto">{k.title}</span>
                        <Badge variant={STATUS_TONE[k.status]}>{t.maintenance.status[k.status]}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-[13px] text-ink-muted">
                        <span>{locale === "ar" ? k.branch_ar : enName.get(k.branch_id) ?? k.branch_ar}</span>
                        <span dir="auto">{k.assignee_display ?? t.maintenance.nobody}</span>
                        {due && <span className={cn(due.late && "font-semibold text-danger")}>{due.text}</span>}
                      </div>
                    </SoftRow>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {isAdmin && (
            <Panel title={t.dashboard.docsTitle} action={<Link href="/documents" className="text-sm font-medium text-primary hover:underline">{t.common.viewAll}</Link>}>
              {docs.length === 0 ? <EmptyNote>{t.dashboard.noDocs}</EmptyNote> : (
                <ul className="divide-y divide-hairline">
                  {docs.slice(0, 5).map((d) => (
                    <li key={d.id}>
                      <Link href={`/workers/${d.worker_id}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 hover:text-primary">
                        <span className="truncate font-medium" dir="auto">{(d.workers as unknown as { full_name: string } | null)?.full_name}</span>
                        <span className="text-[13px] text-ink-muted">{t.worker.docTypes[d.doc_type]}</span>
                        <span className={cn("num text-[13px] font-semibold", d.days <= 45 ? "text-danger" : "text-warning")}>
                          {d.days < 0 ? t.time.expiredDays(-d.days) : t.time.daysLeft(d.days)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
