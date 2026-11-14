import Link from "next/link";
import { PlusIcon, SearchIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { dueInfo, nf, OPEN_STATUSES, timeAgo } from "@/lib/i18n/format";
import { PRIORITY_TONE, STATUS_TONE, type TicketRow } from "@/lib/tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyNote, Kpi, PageHeader, Panel, RowChevron, SoftRow } from "@/components/app/blocks";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = ["open", "overdue", "parts", "resolved", "closed", "all"] as const;
type SP = { tab?: string; branch?: string; cat?: string; q?: string };

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "open";
  const { supabase, profile } = await requireActive();
  const { t, locale } = await getT();
  const M = t.maintenance;
  const n = nf(locale);

  let q = supabase.from("v_tickets").select("*").limit(300);
  if (tab === "open") q = q.in("status", OPEN_STATUSES);
  if (tab === "overdue") q = q.eq("overdue", true);
  if (tab === "parts") q = q.eq("status", "waiting_parts");
  if (tab === "resolved") q = q.eq("status", "resolved");
  if (tab === "closed") q = q.in("status", ["closed", "cancelled"]);
  if (sp.branch) q = q.eq("branch_id", Number(sp.branch));
  if (sp.cat) q = q.eq("category_id", Number(sp.cat));
  if (sp.q) q = q.ilike("title", `%${sp.q}%`);
  q = tab === "closed" || tab === "all" ? q.order("created_at", { ascending: false }) : q.order("due_at", { ascending: true });

  const [{ data }, { data: counts }, { data: branches }, { data: cats }] = await Promise.all([
    q,
    supabase.from("v_tickets").select("status, overdue"),
    supabase.from("branches").select("id, name_ar, name_en").order("city_id").order("sort"),
    supabase.from("ticket_categories").select("id, name_ar, name_en").order("sort"),
  ]);
  const tickets = (data ?? []) as TicketRow[];
  const all = counts ?? [];
  const bName = new Map((branches ?? []).map((b) => [b.id, pick(locale, b.name_ar, b.name_en)]));
  const cName = new Map((cats ?? []).map((c) => [c.id, pick(locale, c.name_ar, c.name_en)]));
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/maintenance?${p.toString()}`;
  };
  const overdueCount = all.filter((x) => x.overdue).length;

  return (
    <>
      <PageHeader title={M.title} sub={M.sub}>
        {profile.role !== "technician" && (
          <Button render={<Link href="/maintenance/new" />} nativeButton={false}><PlusIcon data-icon="inline-start" />{M.newTicket}</Button>
        )}
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={M.stats.open} value={n(all.filter((x) => OPEN_STATUSES.includes(x.status)).length)} highlight />
        <Kpi label={M.stats.overdue} value={n(overdueCount)} tone={overdueCount ? "danger" : undefined} />
        <Kpi label={M.stats.parts} value={n(all.filter((x) => x.status === "waiting_parts").length)} />
        <Kpi label={M.stats.resolved} value={n(all.filter((x) => x.status === "resolved").length)} />
      </section>

      <Panel>
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label={M.title} className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-canvas p-1">
            {TABS.map((k) => (
              <Link key={k} role="tab" aria-selected={tab === k} href={href({ tab: k })} scroll={false}
                className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150", tab === k ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink")}>
                {M.tabs[k]}
              </Link>
            ))}
          </div>

          <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]" action="/maintenance">
            <input type="hidden" name="tab" value={tab} />
            <NativeSelect name="branch" defaultValue={sp.branch ?? ""} aria-label={M.branch} className="w-full">
              <NativeSelectOption value="">{M.allBranches}</NativeSelectOption>
              {(branches ?? []).map((b) => <NativeSelectOption key={b.id} value={b.id}>{pick(locale, b.name_ar, b.name_en)}</NativeSelectOption>)}
            </NativeSelect>
            <NativeSelect name="cat" defaultValue={sp.cat ?? ""} aria-label={M.category} className="w-full">
              <NativeSelectOption value="">{M.allCategories}</NativeSelectOption>
              {(cats ?? []).map((c) => <NativeSelectOption key={c.id} value={c.id}>{pick(locale, c.name_ar, c.name_en)}</NativeSelectOption>)}
            </NativeSelect>
            <Input name="q" defaultValue={sp.q ?? ""} placeholder={M.searchTitle} aria-label={M.searchTitle} dir="auto" />
            <Button type="submit" variant="outline"><SearchIcon data-icon="inline-start" />{M.apply}</Button>
          </form>

          {tickets.length === 0 ? <EmptyNote>{M.empty}</EmptyNote> : (
            <ul className="flex flex-col gap-1.5">
              {tickets.map((k) => {
                const due = dueInfo(t, k.due_at, k.status);
                return (
                  <li key={k.id}>
                    <SoftRow href={`/maintenance/${k.id}`} className="items-start sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="num shrink-0 text-[12.5px] text-ink-muted">#{k.id}</span>
                          <span className="user-text min-w-0 truncate font-medium" dir="auto">{k.title}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-muted">
                          <span>{bName.get(k.branch_id)}</span>
                          <span>{k.category_id ? cName.get(k.category_id) : "—"}</span>
                          <span>{timeAgo(t, k.created_at)}</span>
                          {k.assignee_display && <span dir="auto">{k.assignee_display}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        {k.stops_branch && OPEN_STATUSES.includes(k.status) && <Badge variant="danger">{M.stopped}</Badge>}
                        {k.priority !== "normal" && <Badge variant={PRIORITY_TONE[k.priority]}>{M.priority[k.priority]}</Badge>}
                        <Badge variant={STATUS_TONE[k.status]}>{M.status[k.status]}</Badge>
                        {due && <span className={cn("num whitespace-nowrap text-[12.5px]", due.late ? "font-semibold text-danger" : "text-ink-muted")}>{due.text}</span>}
                      </div>
                      <span className="hidden sm:block"><RowChevron /></span>
                    </SoftRow>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>
    </>
  );
}
