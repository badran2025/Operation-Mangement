import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { EmptyNote, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { Lines } from "./Charts";
import { monthLabel } from "./MonthNav";
import { Change, DieselTable, f0, howMuch, prevLabel, Tile } from "./Overview";
import { StatusBadge } from "./StatusBadge";
import type { aggregate, Period } from "./period";
import type { loadPerformance } from "./perf";

/** One branch over the period: four numbers, what is wrong (in sentences), month by month. */
export function BranchPerf({ t, locale, perf, agg, period, branchId, names }: {
  t: Dict; locale: Locale; perf: Awaited<ReturnType<typeof loadPerformance>>; agg: ReturnType<typeof aggregate>; period: Period; branchId: number; names: Map<number, string>;
}) {
  const O = t.diesel.ov;
  const r = agg.at(branchId), net = agg.net, prev = prevLabel(t, period);
  const netChange = net.lp1000 && agg.prevNet.lp1000 ? ((net.lp1000 / agg.prevNet.lp1000) - 1) * 100 : null;
  const lines: { bad: boolean; text: string }[] = [];
  if (r.valid && !r.estimated) {
    if (r.index !== null && r.index > 120 && net.lp1000) lines.push({ bad: true, text: O.bHigh(howMuch(t, r.lp1000! / net.lp1000)) });
    if (r.change !== null && r.change > 5) lines.push({ bad: true, text: O.bWorse(f0.format(r.change), prev) });
    if (r.change !== null && r.change < -5) lines.push({ bad: false, text: O.bBetter(f0.format(-r.change), prev) });
    const best = r.peers.map((id) => agg.at(id)).sort((a, b) => a.lp1000! - b.lp1000!)[0];
    if (best && best.lp1000! < r.lp1000! * 0.8) lines.push({ bad: true, text: O.bPeer(names.get(best.branchId) ?? "", f0.format(best.lp1000!), f0.format(best.validPieces)) });
    if (r.priceVsRegion !== null && r.priceVsRegion > 5) lines.push({ bad: true, text: O.bPrice(f0.format(r.priceVsRegion)) });
  }
  if (r.unpriced) lines.push({ bad: true, text: O.unpriced(String(r.unpriced)) });
  // month by month: the period's months, or the last 6 for a single month
  const shown = (period.months.length > 1 ? period.months : perf.months.slice(-6)).filter((m) => perf.grid.has(`${branchId}|${m}`));
  const tableMonths = [...shown].reverse().filter((m) => m === period.to || perf.at(branchId, m).liters !== null || perf.at(branchId, m).pieces);
  const chartMonths = shown.filter((m) => perf.at(branchId, m).lp1000 !== null || perf.network.get(m)?.lp1000 !== null);

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label={O.bLp} value={r.lp1000 === null ? "—" : f0.format(r.lp1000)} tone={r.index !== null && r.index > 120 ? "bad" : r.index !== null && r.index < 80 ? "good" : undefined}
          sub={<span className="flex flex-wrap items-center gap-2">{r.status !== "none" && <StatusBadge status={r.status} label={t.diesel.status[r.status]} title={t.diesel.statusHelp[r.status]} />}{net.lp1000 ? O.bAvg(f0.format(net.lp1000)) : null}</span>} />
        <Tile label={O.kLiters} value={r.liters === null ? "—" : `${f0.format(r.liters)} L`} sub={`${O.cols.deliveries}: ${r.deliveries}`} />
        <Tile label={O.kPieces} value={r.pieces ? f0.format(r.pieces) : "—"} />
        <Tile label={O.bChange} value={r.change === null ? "—" : `${r.change > 0 ? "+" : r.change < 0 ? "−" : ""}${f0.format(Math.abs(r.change))}%`} tone={r.change === null ? undefined : r.change > 0 ? "bad" : "good"}
          sub={netChange !== null ? <>{O.avg}: <Change v={netChange} t={t} /></> : undefined} />
        <Tile label={O.bCost} value={r.cost === null ? "—" : f0.format(r.cost)} sub={r.cost !== null ? "SAR" : undefined} />
        <Tile label={O.bSaving} value={r.savingL ? `${f0.format(r.savingL)} L` : "—"} tone={r.savingL ? "good" : undefined} sub={r.savingSAR ? `${f0.format(r.savingSAR)} SAR ${O.bSavingSub}` : O.bSavingSub} />
      </section>

      <Panel title={O.alerts}>
        {!r.valid && !lines.length ? <EmptyNote>{t.diesel.statusHelp.none}</EmptyNote> : lines.length === 0 ? (
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
            { name: O.avg, values: chartMonths.map((m) => perf.network.get(m)?.lp1000 ?? null), color: "var(--ink-muted)", dashed: true },
          ]} />
        </Panel>
      )}

      <Panel title={O.table}>
        <DieselTable t={t} first={O.months} rows={[
          ...tableMonths.map((m) => ({ key: m, label: monthLabel(locale, m), data: perf.at(branchId, m) })),
          ...(period.months.length > 1 && r.liters !== null ? [{ key: "total", label: O.total, total: true, data: { ...r, status: undefined } }] : []),
        ]} />
      </Panel>
    </div>
  );
}
