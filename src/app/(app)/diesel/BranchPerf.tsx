import Link from "next/link";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { EmptyNote, Panel } from "@/components/app/blocks";
import { monthLabel, MonthNav, WhyChanged } from "./PerfSection";
import { PerfTable } from "./PerfTable";
import type { loadPerformance } from "./perf";


/** One branch: its diesel per 1,000 pieces month by month, and why the chosen month changed. */
export function BranchPerf({ t, locale, perf, branchId, month, today, isAdmin }: {
  t: Dict; locale: Locale; perf: Awaited<ReturnType<typeof loadPerformance>>; branchId: number; month: string; today: string; isAdmin: boolean;
}) {
  const P = t.diesel.perf;
  const rows = perf.months.map((m) => ({ m, r: perf.at(branchId, m), net: perf.network.get(m)! })).reverse().filter((x) => x.m === month || x.r.liters !== null || x.r.pieces);
  const cur = perf.at(branchId, month);
  const any = rows.some((x) => x.r.liters !== null || x.r.pieces);
  return (
    <Panel action={isAdmin && <Button size="sm" variant="outline" render={<Link href={`/diesel/months?m=${month}`} />} nativeButton={false}>{P.enter}</Button>}>
      <div id="perf" className="-mt-1 mb-4"><MonthNav t={t} locale={locale} month={month} today={today} href={(m) => `/diesel/${branchId}?m=${m}#perf`} /></div>
      {cur.flags.filter((f) => ["high", "rising", "price"].includes(f)).map((f) => (
        <p key={f} role="alert" className="mb-2 rounded-[14px] bg-danger-soft px-4 py-2.5 text-sm font-semibold text-danger">{P.flags[f]}</p>
      ))}
      {cur.bridge && <div className="mb-4"><WhyChanged t={t} b={cur.bridge} /></div>}
      {!any ? <EmptyNote>{P.noData}</EmptyNote> : (
        <PerfTable storageKey="diesel-branch-cols" firstHeader={P.month}
          rows={rows.map(({ m, r }) => ({ key: m, label: monthLabel(locale, m), sub: P.source[r.source], estimated: r.estimated, highlight: m === month, data: r }))} />
      )}
    </Panel>
  );
}
