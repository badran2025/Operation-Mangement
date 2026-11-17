import Link from "next/link";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { ACTIVE_STATUSES, dueInfo, formatDay, nf, OPEN_STATUSES, timeAgo } from "@/lib/i18n/format";
import { PRIORITY_TONE, STATUS_TONE, type TicketRow } from "@/lib/tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyNote, Kpi, PageHeader, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Workflow stages, in the order a ticket moves through them. */
const STAGES: Record<string, string[]> = { new: ["new"], work: ["assigned", "in_progress"], hold: ["waiting_parts"], confirm: ["resolved"] };
const VIEWS = ["open", "new", "work", "hold", "confirm", "overdue", "closed", "all"];
type SP = { tab?: string; branch?: string; cat?: string; q?: string };

// one grid for the header and every row, so columns line up
const GRID = "lg:grid lg:grid-cols-[88px_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1.05fr)_minmax(0,0.7fr)] lg:items-center lg:gap-4";

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = VIEWS.includes(sp.tab ?? "") ? sp.tab! : "open";
  const { supabase, profile } = await requireActive();
  const { t, locale } = await getT();
  const M = t.maintenance;
  const n = nf(locale);

  let q = supabase.from("v_tickets").select("*").limit(300);
  let c = supabase.from("v_tickets").select("status, overdue");
  if (tab === "open") q = q.in("status", ACTIVE_STATUSES);
  else if (tab === "overdue") q = q.eq("overdue", true);
  else if (tab === "closed") q = q.in("status", ["closed", "cancelled"]);
  else if (STAGES[tab]) q = q.in("status", STAGES[tab]);
  if (sp.branch) { q = q.eq("branch_id", Number(sp.branch)); c = c.eq("branch_id", Number(sp.branch)); }
  if (sp.cat) { q = q.eq("category_id", Number(sp.cat)); c = c.eq("category_id", Number(sp.cat)); }
  const term = (sp.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  if (term) {
    const id = /^#?\d+$/.test(term) ? Number(term.replace("#", "")) : null;
    q = q.or([`title.ilike.%${term}%`, `description.ilike.%${term}%`, ...(id ? [`id.eq.${id}`] : [])].join(","));
  }
  q = tab === "closed" || tab === "all" ? q.order("created_at", { ascending: false }) : q.order("due_at", { ascending: true });

  const [{ data }, { data: counts }, { data: branches }, { data: cats }] = await Promise.all([
    q, c,
    supabase.from("branches").select("id, name_ar, name_en").order("city_id").order("sort"),
    supabase.from("ticket_categories").select("id, name_ar, name_en").order("sort"),
  ]);
  const tickets = (data ?? []) as TicketRow[];
  const all = counts ?? [];
  const count = (k: string) => (k === "overdue" ? all.filter((x) => x.overdue) : all.filter((x) => STAGES[k].includes(x.status))).length;
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/maintenance?${p.toString()}`;
  };
  // the stage where this person is the one expected to act
  const mine = profile.role === "supervisor" ? "confirm" : profile.role === "technician" ? "work" : "new";
  const filtered = Boolean(sp.branch || sp.cat || term);
  const seg = tab === "closed" || tab === "all" ? tab : "open";

  return (
    <>
      <PageHeader title={M.title} sub={M.sub}>
        {profile.role !== "technician" && (
          <Button render={<Link href="/maintenance/new" />} nativeButton={false}><PlusIcon data-icon="inline-start" />{M.newTicket}</Button>
        )}
      </PageHeader>

      {/* the pipeline: each tile is a stage and filters the list */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label={M.col.status}>
        {(["new", "work", "hold", "confirm", "overdue"] as const).map((k) => {
          const v = count(k);
          return (
            <Kpi key={k} label={M.stages[k]} value={n(v)} href={href({ tab: tab === k ? "open" : k })} active={tab === k}
              tone={v && (k === "overdue" || k === "new") ? "danger" : undefined}
              hint={k === mine && v > 0 ? M.yourAction : undefined}
              className={k === "overdue" ? "col-span-2 md:col-span-1" : undefined} />
          );
        })}
      </section>

      <Panel>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label={M.title} className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-canvas p-1">
              {(["open", "closed", "all"] as const).map((k) => (
                <Link key={k} role="tab" aria-selected={seg === k} href={href({ tab: k })} scroll={false}
                  className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150", seg === k ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink")}>
                  {M.tabs[k]}{k === "open" && <span className="num ms-1.5 opacity-75">{n(all.filter((x) => ACTIVE_STATUSES.includes(x.status)).length)}</span>}
                </Link>
              ))}
            </div>
            {(STAGES[tab] || tab === "overdue") && (
              <Link href={href({ tab: "open" })} scroll={false} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-tint px-3 text-sm font-medium text-accent-foreground">
                {M.showing(M.stages[tab])}<XIcon className="size-3.5" aria-label={M.clear} />
              </Link>
            )}
          </div>

          <form className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]" action="/maintenance">
            <input type="hidden" name="tab" value={tab} />
            <NativeSelect name="branch" defaultValue={sp.branch ?? ""} aria-label={M.branch} className="w-full">
              <NativeSelectOption value="">{M.allBranches}</NativeSelectOption>
              {(branches ?? []).map((b) => <NativeSelectOption key={b.id} value={b.id}>{pick(locale, b.name_ar, b.name_en)}</NativeSelectOption>)}
            </NativeSelect>
            <NativeSelect name="cat" defaultValue={sp.cat ?? ""} aria-label={M.category} className="w-full">
              <NativeSelectOption value="">{M.allCategories}</NativeSelectOption>
              {(cats ?? []).map((x) => <NativeSelectOption key={x.id} value={x.id}>{pick(locale, x.name_ar, x.name_en)}</NativeSelectOption>)}
            </NativeSelect>
            <Input name="q" defaultValue={sp.q ?? ""} placeholder={M.searchTitle} aria-label={M.searchTitle} dir="auto" className="col-span-2 sm:col-span-1" />
            <div className="col-span-2 flex gap-2 sm:col-span-1">
              <Button type="submit" variant="outline" className="flex-1"><SearchIcon data-icon="inline-start" />{M.apply}</Button>
              {filtered && <Button variant="ghost" render={<Link href={`/maintenance?tab=${tab}`} />} nativeButton={false}>{M.clear}</Button>}
            </div>
          </form>

          {tickets.length === 0 ? <EmptyNote>{M.empty}</EmptyNote> : (
            <div role="table" aria-label={M.title} className="flex flex-col gap-1.5">
              <div role="row" className={cn("hidden px-3.5 pb-0.5 text-[12.5px] font-semibold text-ink-muted", GRID)}>
                {[M.col.priority, M.col.problem, M.col.branch, M.col.reported, M.col.assignee, M.col.status, M.col.due].map((h) => <span key={h} role="columnheader">{h}</span>)}
              </div>
              {tickets.map((k) => {
                const due = dueInfo(t, k.due_at, k.status);
                const stopped = k.stops_branch && OPEN_STATUSES.includes(k.status);
                const done = k.status === "closed" || k.status === "cancelled";
                const priority = <Badge variant={PRIORITY_TONE[k.priority]}>{M.priority[k.priority]}</Badge>;
                const status = <Badge variant={STATUS_TONE[k.status]}>{M.status[k.status]}</Badge>;
                const assignee = k.assignee_display
                  ? <span className="font-medium text-ink" dir="auto">{k.assignee_display}</span>
                  : <span className="font-medium text-warning">{done ? "—" : M.nobody}</span>;
                const dueCell = due ? <span className={cn("num whitespace-nowrap", due.late ? "font-semibold text-danger" : "text-ink-muted")}>{due.text}</span>
                  : done && k.closed_at ? <span className="text-ink-muted">{M.closedOn(formatDay(locale, k.closed_at))}</span>
                  : k.resolved_at ? <span className="text-ink-muted">{M.fixedOn(formatDay(locale, k.resolved_at))}</span> : <span className="text-ink-muted">—</span>;
                const branch = pick(locale, k.branch_ar, k.branch_en);
                const category = [k.category_id ? pick(locale, k.category_ar, k.category_en) : null, k.equipment_code && `${k.equipment_code} ${k.equipment_name}`].filter(Boolean).join(t.common.comma) || null;
                return (
                  <Link key={k.id} role="row" href={`/maintenance/${k.id}`}
                    className={cn("block rounded-[14px] bg-canvas px-3.5 py-3 text-sm transition-colors duration-150 hover:bg-surface-sunken", GRID)}>
                    {/* phone: a card */}
                    <div className="flex flex-col gap-2 lg:hidden">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {priority}{status}{stopped && <Badge variant="danger">{M.stopped}</Badge>}
                        <span className="ms-auto text-[13px]">{dueCell}</span>
                      </div>
                      <div>
                        <p className="flex gap-1.5 text-[15px]"><span className="num shrink-0 text-ink-muted">#{k.id}</span><span className="user-text line-clamp-2 min-w-0 flex-1 font-semibold" dir="auto">{k.title}</span></p>
                        {k.description && <p className="user-text mt-0.5 line-clamp-1 text-[13px] text-ink-muted" dir="auto">{k.description}</p>}
                      </div>
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[13px]">
                        <dt className="text-ink-muted">{M.col.branch}</dt><dd className="m-0 truncate">{branch}{category && <span className="text-ink-muted">{t.common.comma}{category}</span>}</dd>
                        <dt className="text-ink-muted">{M.col.reported}</dt><dd className="m-0 truncate"><span className="num">{formatDay(locale, k.created_at)}</span>{k.reporter_display && <span dir="auto"> {M.by(k.reporter_display)}</span>}</dd>
                        <dt className="text-ink-muted">{M.col.assignee}</dt><dd className="m-0 truncate">{assignee}</dd>
                      </dl>
                    </div>

                    {/* desktop: table cells */}
                    <span role="cell" className="hidden flex-col items-start gap-1 lg:flex">{priority}{stopped && <Badge variant="danger">{M.stopped}</Badge>}</span>
                    <span role="cell" className="hidden min-w-0 lg:block">
                      <span className="flex gap-1.5"><span className="num shrink-0 text-ink-muted">#{k.id}</span><span className="user-text line-clamp-2 min-w-0 flex-1 font-semibold text-ink" dir="auto">{k.title}</span></span>
                      {k.description && <span className="user-text line-clamp-1 text-[13px] text-ink-muted" dir="auto">{k.description}</span>}
                    </span>
                    <span role="cell" className="hidden min-w-0 lg:block">
                      <span className="block truncate">{branch}</span>
                      {category && <span className="block truncate text-[13px] text-ink-muted">{category}</span>}
                    </span>
                    <span role="cell" className="hidden min-w-0 lg:block">
                      <span className="block truncate" dir="auto">{k.reporter_display ?? "—"}</span>
                      <span className="num block truncate text-[13px] text-ink-muted" title={timeAgo(t, k.created_at)}>{formatDay(locale, k.created_at)}{t.common.comma}{timeAgo(t, k.created_at)}</span>
                    </span>
                    <span role="cell" className="hidden min-w-0 truncate lg:block">{assignee}</span>
                    <span role="cell" className="hidden min-w-0 lg:block">
                      {status}
                      {k.status === "waiting_parts" && k.hold_reason && <span className="user-text mt-1 line-clamp-1 block text-[13px] text-ink-muted" dir="auto">{k.hold_reason}</span>}
                    </span>
                    <span role="cell" className="hidden text-[13px] lg:block">{dueCell}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
