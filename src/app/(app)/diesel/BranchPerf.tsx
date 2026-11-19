import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { EmptyNote, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { Lines } from "./Charts";
import { monthLabel, MonthNav } from "./MonthNav";
import { Change, DieselTable, f0, howMuch, Tile } from "./Overview";
import { StatusBadge } from "./StatusBadge";
import type { loadPerformance } from "./perf";

/** One branch: four numbers, what is wrong (in sentences), month by month. */
export function BranchPerf({ t, locale, perf, branchId, month, today, isAdmin, names }: {
  t: Dict; locale: Locale; perf: Awaited<ReturnType<typeof loadPerformance>>; branchId: number; month: string; today: string; isAdmin: boolean; names: Map<number, string>;
}) {
  const O = t.diesel.ov, P = t.diesel.perf;
  const r = perf.at(branchId, month), net = perf.network.get(month)!;
  const prevNet = perf.network.get(perf.months[perf.months.length - 2]);
  const netChange = net.lp1000 && prevNet?.lp1000 ? ((net.lp1000 / prevNet.lp1000) - 1) * 100 : null;
  const lines: { bad: boolean; text: string }[] = [];
  if (r.valid && !r.estimated) {
    if (r.index !== null && r.index > 120 && net.lp1000) lines.push({ bad: true, text: O.bHigh(howMuch(t, r.lp1000! / net.lp1000)) });
    if (r.change !== null && r.change > 5) lines.push({ bad: true, text: O.bWorse(f0.format(r.change)) });
    if (r.change !== null && r.change < -5) lines.push({ bad: false, text: O.bBetter(f0.format(-r.change)) });
    const best = r.peers.map((id) => perf.at(id, month)).sort((a, b) => a.lp1000! - b.lp1000!)[0];
    if (best && best.lp1000! < r.lp1000! * 0.8) lines.push({ bad: true, text: O.bPeer(names.get(best.branchId) ?? "", f0.format(best.lp1000!), f0.format(best.pieces!)) });
    if (r.priceVsRegion !== null && r.priceVsRegion > 5) lines.push({ bad: true, text: O.bPrice(f0.format(r.priceVsRegion)) });
  }
  const months = [...perf.months].reverse().filter((m) => m === month || perf.at(branchId, m).liters !== null || perf.at(branchId, m).pieces);
  const chartMonths = perf.months.filter((m) => perf.at(branchId, m).lp1000 !== null || perf.network.get(m)!.lp1000 !== null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <MonthNav t={t} locale={locale} month={month} today={today} href={(m) => `/diesel/${branchId}?m=${m}`} />
        {r.status !== "none" && <StatusBadge status={r.status} label={t.diesel.status[r.status]} title={t.diesel.statusHelp[r.status]} />}
        {isAdmin && <Button size="sm" variant="outline" className="ms-auto" render={<Link href={`/diesel/months?m=${month}`} />} nativeButton={false}>{P.enter}</Button>}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={O.bLp} value={r.lp1000 === null ? "—" : f0.format(r.lp1000)} tone={r.index !== null && r.index > 120 ? "bad" : r.index !== null && r.index < 80 ? "good" : undefined} sub={net.lp1000 ? O.bAvg(f0.format(net.lp1000)) : undefined} />
        <Tile label={O.bChange} value={r.change === null ? "—" : `${r.change > 0 ? "+" : r.change < 0 ? "−" : ""}${f0.format(Math.abs(r.change))}%`} tone={r.change === null ? undefined : r.change > 0 ? "bad" : "good"}
          sub={netChange !== null ? <>{O.avg}: <Change v={netChange} t={t} /></> : undefined} />
        <Tile label={O.bCost} value={r.cost === null ? "—" : f0.format(r.cost)} sub={r.liters !== null ? `SAR · ${f0.format(r.liters)} L` : undefined} />
        <Tile label={O.bSaving} value={r.savingL ? `${f0.format(r.savingL)} L` : "—"} tone={r.savingL ? "good" : undefined} sub={r.savingSAR ? `${f0.format(r.savingSAR)} SAR ${O.bSavingSub}` : O.bSavingSub} />
      </section>

      <Panel title={O.alerts}>
        {!r.valid ? <EmptyNote>{t.diesel.statusHelp.none}</EmptyNote> : lines.length === 0 ? (
          <p className="m-0 flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-3 text-[15px] text-success"><CheckCircle2Icon className="size-4" aria-hidden />{O.bFine}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {lines.map((l) => (
              <li key={l.text} className={cn("flex items-start gap-3 rounded-[14px] px-4 py-3 text-[15px] leading-7", l.bad ? "bg-danger-soft" : "bg-success-soft")}>
                {l.bad ? <AlertTriangleIcon className="mt-1.5 size-4 shrink-0 text-danger" aria-hidden /> : <CheckCircle2Icon className="mt-1.5 size-4 shrink-0 text-success" aria-hidden />}
                <span className="num">{l.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {chartMonths.length >= 2 && (
        <Panel title={`${O.overTime}: ${O.bLp}`}>
          <Lines labels={chartMonths.map((m) => monthLabel(locale, m, false))} series={[
            { name: names.get(branchId) ?? "", values: chartMonths.map((m) => perf.at(branchId, m).lp1000), color: "var(--primary)" },
            { name: O.avg, values: chartMonths.map((m) => perf.network.get(m)!.lp1000), color: "var(--ink-muted)", dashed: true },
          ]} />
        </Panel>
      )}

      <Panel title={O.table}>
        <DieselTable t={t} first={O.months} rows={months.map((m) => ({ key: m, label: monthLabel(locale, m), highlight: m === month, data: perf.at(branchId, m) }))} />
      </Panel>
    </div>
  );
}
