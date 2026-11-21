import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FuelIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { formatDate, timeAgo } from "@/lib/i18n/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, RowChevron, SoftRow } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { monthLabel } from "./MonthNav";
import { StatusBadge } from "./StatusBadge";
import { dieselSummary } from "./summary";

const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

/** Home page: which branches need diesel now, which need a reading, which are at risk. */
export async function DieselHome({ supabase, t, locale, names }: { supabase: SupabaseClient; t: Dict; locale: Locale; names: Map<number, string> }) {
  const { month, rows } = await dieselSummary(supabase);
  const H = t.dashboard.diesel;
  const due = rows.filter((r) => !r.st.stale && r.nextIn !== null && r.nextIn <= 3);
  const reading = rows.filter((r) => r.hasTanks && (r.st.stale || r.st.lastAt === null));
  const risk = rows.filter((r) => r.status === "risk");
  const groups = [
    { key: "due", label: H.due, list: due, href: "/diesel?tab=tanks", tone: "danger" as const },
    { key: "reading", label: H.reading, list: reading, href: "/diesel?tab=tanks", tone: "secondary" as const },
    { key: "risk", label: H.risk(monthLabel(locale, month)), list: risk, href: `/diesel?p=1&m=${month}`, tone: "danger" as const },
  ].filter((g) => g.list.length);
  return (
    <Panel title={H.title} action={<Link href="/diesel" className="text-sm font-medium text-primary hover:underline">{H.open}</Link>}>
      {groups.length === 0 ? <p className="m-0 rounded-[14px] bg-success-soft px-4 py-3 text-sm text-success">{H.allGood}</p> : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li key={g.key}>
              <SoftRow href={g.href}>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{g.label}</span>
                  <span className="block truncate text-[13px] text-ink-muted">{g.list.map((r) => names.get(r.id) ?? "").join("، ")}</span>
                </span>
                <Badge variant={g.tone}>{g.list.length}</Badge>
                <RowChevron />
              </SoftRow>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Branch page: the branch's diesel in one line, with the way to the full diesel page. */
export async function DieselStrip({ supabase, t, locale, branchId }: { supabase: SupabaseClient; t: Dict; locale: Locale; branchId: number }) {
  const { month, rows, net } = await dieselSummary(supabase, branchId);
  const r = rows[0];
  if (!r) return null; // electric or closed
  const D = t.diesel, H = t.dashboard.diesel;
  const pct = r.st.stockNow !== null && r.st.cap ? Math.round((r.st.stockNow / r.st.cap) * 100) : null;
  const item = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <dt className="text-[12.5px] text-ink-muted">{label}</dt>
      <dd className="num m-0 flex flex-wrap items-center gap-2 text-[15px] font-semibold">{value}</dd>
    </div>
  );
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4 md:flex-row md:items-center md:p-5" aria-label={H.title}>
      <span className="flex items-center gap-2 text-[17px] font-semibold"><FuelIcon className="size-5 text-primary" aria-hidden />{H.title}</span>
      <dl className="m-0 grid flex-1 grid-cols-2 gap-3 md:grid-cols-3 md:px-4">
        {item(D.table.stock, !r.hasTanks ? <span className="font-normal text-ink-muted">{H.noTanks}</span>
          : r.st.stale ? <span className="text-ink-muted">{D.needsReading} <span className="text-[12.5px] font-normal">· {D.staleLine(f0.format(r.st.stockAt ?? 0), timeAgo(t, new Date(r.st.lastAt!).toISOString()))}</span></span>
          : r.st.stockNow !== null ? <span className={cn((pct ?? 100) < 25 && "text-danger")}>≈ {f0.format(r.st.stockNow)} L <span className="text-[12.5px] font-normal text-ink-muted">({pct}%)</span></span> : "—")}
        {item(H.lp(monthLabel(locale, month)), r.lp1000 === null ? "—" : <>{f0.format(r.lp1000)}{r.status !== "none" && <StatusBadge status={r.status} label={D.status[r.status]} title={net ? D.ov.bAvg(f0.format(net)) : undefined} />}</>)}
        {item(D.table.lastDelivery, r.st.last ? `${formatDate(locale, r.st.last.refuel_date)} · ${f0.format(r.st.last.liters)} L` : "—")}
      </dl>
      <Button variant="outline" render={<Link href={`/diesel?b=${branchId}`} />} nativeButton={false}>{H.details}</Button>
    </section>
  );
}
