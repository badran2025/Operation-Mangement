import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPinIcon, PlusIcon, WrenchIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries";
import { dueInfo, formatDaysOff, formatShifts, formatTime, nf, OPEN_STATUSES } from "@/lib/i18n/format";
import type { WorkerRow } from "@/lib/types";
import { STATUS_TONE, type TicketRow } from "@/lib/tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyNote, Kpi, PageHeader, Panel, RowChevron, SoftRow } from "@/components/app/blocks";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Hours = { weekday: number; open_time: string | null; close_time: string | null; is_24h: boolean; is_closed: boolean };

function hoursLines(t: Dict, hours: Hours[]): string[] {
  if (hours.length === 0) return ["—"];
  const fmt = (h: Hours) => (h.is_24h ? t.branch.open24 : h.is_closed ? t.branch.closed : `${formatTime(t, h.open_time)} – ${formatTime(t, h.close_time)}`);
  const groups = new Map<string, number[]>();
  for (const h of hours) groups.set(fmt(h), [...(groups.get(fmt(h)) ?? []), h.weekday]);
  if (groups.size === 1) return [`${t.branch.daily}: ${[...groups.keys()][0]}`];
  return [...groups.entries()].map(([v, days]) => `${days.length >= 5 ? t.branch.otherDays : days.map((d) => t.weekdays[d]).join(t.common.comma)}: ${v}`);
}


export default async function BranchPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, profile } = await requireActive();
  const { t, locale } = await getT();
  const n = nf(locale);

  const [{ data: branch }, { data: hours }, { data: workers }, { data: tix }] = await Promise.all([
    supabase.from("branches").select("*, cities(name_ar, name_en)").eq("id", id).maybeSingle(),
    supabase.from("branch_hours").select("*").eq("branch_id", id).order("weekday"),
    supabase.from("v_workers_current").select("*").eq("branch_id", id).order("full_name"),
    supabase.from("v_tickets").select("*").eq("branch_id", id).in("status", OPEN_STATUSES).order("due_at"),
  ]);
  if (!branch) notFound();
  const list = (workers ?? []) as WorkerRow[];
  const openTickets = (tix ?? []) as TicketRow[];
  const isAdmin = profile.role === "admin";
  const city = branch.cities as { name_ar: string; name_en: string } | null;
  const active = list.filter((w) => w.status === "active");
  const offToday = active.filter((w) => w.off_today).length;
  const overdue = openTickets.filter((k) => k.overdue).length;
  const name = pick(locale, branch.name_ar, branch.name_en);
  const otherName = locale === "ar" ? branch.name_en : branch.name_ar;

  return (
    <>
      <PageHeader
        back={{ href: "/", label: t.nav.overview }}
        title={name}
        sub={<span>{pick(locale, city?.name_ar, city?.name_en)}<span className="mx-2 text-hairline" aria-hidden>|</span><span lang={locale === "ar" ? "en" : "ar"}>{otherName}</span></span>}
      >
        {branch.map_url && (
          <Button variant="outline" render={<a href={branch.map_url} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <MapPinIcon data-icon="inline-start" />{t.common.map}
          </Button>
        )}
        <Button variant="outline" render={<Link href={`/maintenance/new?branch=${id}`} />} nativeButton={false}>
          <WrenchIcon data-icon="inline-start" />{t.branch.reportIssue}
        </Button>
        {isAdmin && (
          <Button render={<Link href={`/workers/new?branch=${id}`} />} nativeButton={false}>
            <PlusIcon data-icon="inline-start" />{t.branch.addWorker}
          </Button>
        )}
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={name}>
        <Kpi label={t.dashboard.workers} value={n(list.filter((w) => w.status !== "terminated").length)} highlight />
        <Kpi label={t.dashboard.workingToday} value={n(active.length - offToday)} />
        <Kpi label={t.dashboard.openTickets} value={n(openTickets.length)} />
        <Kpi label={t.dashboard.overdue} value={n(overdue)} tone={overdue ? "danger" : undefined} />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <dt className="text-[13px] font-medium text-ink-muted">{t.branch.hours}</dt>
              {hoursLines(t, (hours ?? []) as Hours[]).map((l) => <dd key={l} className="m-0">{l}</dd>)}
              {branch.hours_note && <dd className="m-0 mt-1 text-[13px] text-warning" dir="auto">{branch.hours_note}</dd>}
            </div>
            <div>
              <dt className="text-[13px] font-medium text-ink-muted">{t.branch.ppm}</dt>
              <dd className="m-0">{branch.ppm_weekday !== null ? t.branch.ppmAt(t.weekdays[branch.ppm_weekday], formatTime(t, branch.ppm_time)) : t.common.notSet}</dd>
            </div>
            {branch.phone && (
              <div>
                <dt className="text-[13px] font-medium text-ink-muted">{t.branch.contact}</dt>
                <dd className="m-0"><a href={`tel:${branch.phone}`} dir="ltr" className="text-primary hover:underline">{branch.phone}</a></dd>
              </div>
            )}
          </dl>
        </Panel>

        <Panel
          title={t.branch.openTicketsTitle}
          action={<Link href={`/maintenance?tab=open&branch=${id}`} className="text-sm font-medium text-primary hover:underline">{t.branch.allBranchTickets}</Link>}
        >
          {openTickets.length === 0 ? <EmptyNote>{t.maintenance.empty}</EmptyNote> : (
            <ul className="flex flex-col gap-1.5">
              {openTickets.slice(0, 6).map((k) => {
                const due = dueInfo(t, k.due_at, k.status);
                return (
                  <li key={k.id}>
                    <SoftRow href={`/maintenance/${k.id}`}>
                      <span className="user-text min-w-0 flex-1 truncate font-medium" dir="auto">{k.title}</span>
                      {due && <span className={cn("hidden whitespace-nowrap text-[13px] sm:inline", due.late ? "font-semibold text-danger" : "text-ink-muted")}>{due.text}</span>}
                      <Badge variant={STATUS_TONE[k.status] ?? "neutral"}>{t.maintenance.status[k.status]}</Badge>
                      <RowChevron />
                    </SoftRow>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={`${t.branch.workersTitle} (${n(list.length)})`}>
        {list.length === 0 ? <EmptyNote>{t.branch.noWorkers}</EmptyNote> : (
          <div className="-mx-4 overflow-x-auto md:-mx-5">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {[t.branch.col.name, t.branch.col.job, t.branch.col.shift, t.branch.col.dayOff, t.branch.col.housing, t.branch.col.status].map((h, i) => (
                    <TableHead key={h} className={cn("h-10 text-[12.5px] font-semibold text-ink-muted", i === 0 && "ps-4 md:ps-5")}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((w) => {
                  const dayOffMissing = !w.no_day_off && w.days_off.length === 0;
                  return (
                    <TableRow key={w.id} className="border-hairline">
                      <TableCell className="py-3 ps-4 md:ps-5">
                        {isAdmin ? (
                          <Link href={`/workers/${w.id}`} className="font-semibold text-primary hover:underline" dir="auto">{w.full_name}</Link>
                        ) : <span className="font-semibold" dir="auto">{w.full_name}</span>}
                        {(w.alt_name || w.emp_no) && (
                          <div className="text-[12.5px] text-ink-muted">
                            {w.alt_name && <span dir="auto">{w.alt_name}</span>}
                            {w.alt_name && w.emp_no && <span className="mx-1.5 text-hairline" aria-hidden>|</span>}
                            {w.emp_no && <span dir="ltr" className="num">{w.emp_no}</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{w.job_title_ar ? pick(locale, w.job_title_ar, w.job_title_en) : <span className="text-warning">{t.branch.notSetWarn}</span>}</TableCell>
                      <TableCell className="whitespace-nowrap">{w.shifts.length ? formatShifts(t, w.shifts) : <span className="text-warning">{t.branch.notSetWarn}</span>}</TableCell>
                      <TableCell>
                        <span className={cn(dayOffMissing && "text-warning")}>{dayOffMissing ? t.branch.notSetWarn : formatDaysOff(t, w.days_off, w.no_day_off)}</span>
                        {w.off_today && w.status === "active" && <Badge variant="warning" className="ms-2">{t.branch.offToday}</Badge>}
                      </TableCell>
                      <TableCell dir="auto">{w.housing_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={w.status === "active" ? "success" : w.status === "on_leave" ? "info" : "neutral"}>{t.worker.status[w.status]}</Badge>
                        {w.notes && <div className="mt-1 max-w-[220px] truncate text-[12.5px] text-ink-muted" dir="auto" title={w.notes}>{w.notes}</div>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}
