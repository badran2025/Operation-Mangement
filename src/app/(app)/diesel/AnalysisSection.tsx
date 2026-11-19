import Link from "next/link";
import { LightbulbIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { EmptyNote, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { Bars, Lines, Scatter, Sparkline } from "./Charts";
import { monthLabel, MonthNav } from "./PerfSection";
import { StatusBadge } from "./StatusBadge";
import type { BranchMonth, loadPerformance } from "./perf";

const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const pc = (v: number) => f0.format(Math.abs(v));
const signed = (v: number) => `⁦${v > 0 ? "+" : v < 0 ? "−" : ""}${f0.format(Math.abs(v))}%⁩`;

/** Readings, branch by branch status, pieces-vs-diesel chart, comparison with similar branches, and a branch over time. */
export function AnalysisSection({ t, locale, perf, month, today, names, focus }: {
  t: Dict; locale: Locale; perf: Awaited<ReturnType<typeof loadPerformance>>; month: string; today: string; names: Map<number, string>; focus: number | null;
}) {
  const A = t.diesel.an;
  const net = perf.network.get(month)!;
  const rows = perf.branches.map((b) => perf.at(b.id, month));
  const ok = rows.filter((r) => r.valid && !r.estimated);
  const nm = (id: number) => names.get(id) ?? "";

  // ---- readings
  const readings: string[] = [];
  const nb = perf.netBridge(month);
  const prev = perf.network.get(perf.months[perf.months.length - 2]);
  if (net.lp1000 && prev?.lp1000 && nb) {
    const ch = ((net.lp1000 / prev.lp1000) - 1) * 100;
    readings.push(ch <= 0 ? A.netBetter(pc(ch), f0.format(Math.max(-nb.liters.efficiency, 0))) : A.netWorse(pc(ch), f0.format(Math.max(nb.liters.efficiency, 0))));
  }
  const worst = [...ok].sort((a, b) => (b.index ?? 0) - (a.index ?? 0))[0];
  if (worst?.index) readings.push(A.worst(nm(worst.branchId), f0.format(worst.lp1000!), f0.format(worst.index)));
  const withOwn = ok.filter((r) => r.vsOwnAvg !== null);
  const worsened = [...withOwn].sort((a, b) => b.vsOwnAvg! - a.vsOwnAvg!)[0];
  if (worsened && worsened.vsOwnAvg! > 5) readings.push(A.worsened(nm(worsened.branchId), pc(worsened.vsOwnAvg!)));
  const improved = [...withOwn].sort((a, b) => a.vsOwnAvg! - b.vsOwnAvg!)[0];
  if (improved && improved.vsOwnAvg! < -5) readings.push(A.improved(nm(improved.branchId), pc(improved.vsOwnAvg!)));
  // the two branches with similar work and the biggest gap
  let pair: [BranchMonth, BranchMonth] | null = null, gap = 0;
  for (const a of ok) for (const b of ok) if (a !== b && Math.abs(a.pieces! / b.pieces! - 1) <= 0.25 && a.lp1000! / b.lp1000! - 1 > gap) { gap = a.lp1000! / b.lp1000! - 1; pair = [a, b]; }
  if (pair && gap > 0.2) readings.push(A.pair(nm(pair[0].branchId), nm(pair[1].branchId), f0.format(pair[0].pieces!), f0.format(pair[1].pieces!), f0.format(gap * 100), f0.format(pair[0].lp1000!), f0.format(pair[1].lp1000!)));
  const savers = ok.filter((r) => (r.savingL ?? 0) > 0).sort((a, b) => b.savingL! - a.savingL!);
  const saveL = savers.reduce((s, r) => s + r.savingL!, 0), saveSAR = savers.reduce((s, r) => s + (r.savingSAR ?? 0), 0);
  if (saveL > 0) readings.push(A.saving(f0.format(saveL), f0.format(saveSAR), savers.slice(0, 3).map((r) => nm(r.branchId)).join("، ")));
  const top5 = [...ok].sort((a, b) => b.liters! - a.liters!).slice(0, 5);
  if (ok.length > 6 && net.liters && net.pieces) readings.push(A.concentration(f0.format((top5.reduce((s, r) => s + r.liters!, 0) / net.liters) * 100), f0.format((top5.reduce((s, r) => s + r.pieces!, 0) / net.pieces) * 100)));

  // ---- board
  const board = [...rows].sort((a, b) => (b.savingL ?? -1) - (a.savingL ?? -1));
  const series = (id: number) => perf.months.map((m) => perf.at(id, m).lp1000);

  // ---- focus branch
  const fid = focus && rows.some((r) => r.branchId === focus) ? focus : (savers.find((r) => r.peers.length)?.branchId ?? worst?.branchId ?? rows[0]?.branchId);
  const f = perf.at(fid, month);
  const monthsShort = perf.months.map((m) => monthLabel(locale, m, false));
  // the chart starts at the first month that has figures
  const firstData = perf.months.findIndex((m) => perf.network.get(m)!.lp1000 !== null || perf.at(fid, m).lp1000 !== null);
  const span = firstData < 0 ? 0 : firstData;

  return (
    <div className="flex flex-col gap-4">
      <MonthNav t={t} locale={locale} month={month} today={today} href={(m) => `/diesel?tab=analysis&m=${m}${focus ? `&b=${focus}` : ""}`} />

      <Panel title={A.readings}>
        {readings.length === 0 ? <EmptyNote>{A.noReadings}</EmptyNote> : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {readings.map((r) => <li key={r} className="num flex items-start gap-2.5 rounded-[14px] bg-canvas px-3.5 py-3 text-sm leading-6"><LightbulbIcon className="mt-1 size-4 shrink-0 text-primary" aria-hidden />{r}</li>)}
          </ul>
        )}
      </Panel>

      <Panel title={A.board}>
        <p className="-mt-1 mb-3 text-sm text-ink-muted">{A.boardSub}</p>
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-[12.5px] text-ink-muted">
                {["branch", "status", "trend", "own", "peers", "network", "saving"].map((k, i) => <th key={k} className={cn("h-10 px-2.5 font-semibold", i === 0 ? "ps-4 text-start md:ps-5" : i <= 2 ? "text-start" : "text-end")}>{A.cols[k]}</th>)}
              </tr>
            </thead>
            <tbody>
              {board.map((r) => (
                <tr key={r.branchId} className="border-t border-hairline">
                  <td className="py-2.5 ps-4 pe-2.5 md:ps-5"><Link href={`/diesel?tab=analysis&m=${month}&b=${r.branchId}#compare`} className="font-semibold text-primary hover:underline">{nm(r.branchId)}</Link></td>
                  <td className="px-2.5"><StatusBadge status={r.status} label={r.estimated ? t.diesel.perf.estimated : t.diesel.status[r.status]} title={t.diesel.statusHelp[r.status]} />{r.trend && <span className={cn("ms-2 text-[12px] font-medium", r.trend === "worsening" ? "text-danger" : r.trend === "improving" ? "text-success" : "text-ink-muted")}>{t.diesel.trend[r.trend]}</span>}</td>
                  <td className="px-2.5"><Sparkline values={series(r.branchId)} label={`${nm(r.branchId)}: ${series(r.branchId).map((v, i) => `${monthsShort[i]} ${v === null ? "—" : f0.format(v)}`).join(", ")}`} /></td>
                  <td className={cn("num px-2.5 text-end", r.vsOwnAvg === null ? "text-ink-muted" : r.vsOwnAvg > 5 ? "text-danger" : r.vsOwnAvg < -5 ? "text-success" : "")}>{r.vsOwnAvg === null ? "—" : signed(r.vsOwnAvg)}</td>
                  <td className={cn("num px-2.5 text-end", r.peerGap === null ? "text-ink-muted" : r.peerGap > 20 ? "text-danger" : r.peerGap < -20 ? "text-success" : "")} title={r.peers.map(nm).join("، ")}>{r.peerGap === null ? (r.valid ? A.noPeers : "—") : signed(r.peerGap)}</td>
                  <td className={cn("num px-2.5 text-end font-semibold", r.index === null ? "text-ink-muted" : r.index > 120 ? "text-danger" : r.index < 80 ? "text-success" : "")}>{r.index === null ? "—" : f0.format(r.index)}</td>
                  <td className="num px-2.5 text-end">{r.savingL ? <><b className="font-semibold">{f0.format(r.savingL)} L</b>{r.savingSAR ? <span className="block text-[12px] text-ink-muted">{f0.format(r.savingSAR)} SAR {A.perMonth}</span> : null}</> : <span className="text-ink-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={A.scatter}>
        <p className="-mt-1 mb-3 text-sm text-ink-muted">{A.scatterSub}</p>
        {ok.length < 2 ? <EmptyNote>{A.noReadings}</EmptyNote> : (
          <Scatter slope={net.lp1000 ? net.lp1000 / 1000 : null} xLabel={A.xPieces} yLabel={A.yLiters} avgLabel={A.avgLine}
            legend={(["risk", "watch", "normal", "good"] as const).map((k) => [k, t.diesel.status[k]])}
            dots={ok.map((r) => ({ id: r.branchId, label: nm(r.branchId), x: r.pieces!, y: r.liters!, status: r.status, tip: `${nm(r.branchId)} · ${f0.format(r.pieces!)} ${A.xPieces} · ${f0.format(r.liters!)} L · ${f0.format(r.lp1000!)} L/1,000 · ${t.diesel.status[r.status]}` }))} />
        )}
      </Panel>

      <div id="compare" className="grid gap-4 xl:grid-cols-2">
        <Panel title={A.compare}>
          <p className="-mt-1 mb-3 text-sm text-ink-muted">{A.compareSub}</p>
          <form method="get" action="/diesel" className="mb-4 flex items-end gap-2">
            <input type="hidden" name="tab" value="analysis" /><input type="hidden" name="m" value={month} />
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">{A.pick}
              <NativeSelect name="b" defaultValue={String(fid)} className="w-full">
                {rows.map((r) => <NativeSelectOption key={r.branchId} value={r.branchId}>{nm(r.branchId)}</NativeSelectOption>)}
              </NativeSelect>
            </label>
            <Button type="submit" variant="outline">{t.diesel.perf.cols2.show}</Button>
          </form>
          {!f.valid ? <EmptyNote>{t.diesel.statusHelp.none}</EmptyNote> : (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-sm font-semibold">{A.peersOf(nm(fid))}</p>
              {f.peers.length === 0 ? <EmptyNote>{A.noPeers}</EmptyNote> : (
                <>
                  <Bars unit="L / 1,000" mark={net.lp1000} refLabel={A.network}
                    items={[f, ...f.peers.map((id) => perf.at(id, month))].sort((a, b) => b.lp1000! - a.lp1000!).map((r) => ({ label: `${nm(r.branchId)} (${f0.format(r.pieces!)})`, value: r.lp1000!, highlight: r.branchId === fid }))} />
                  {f.peerGap !== null && <p className={cn("m-0 rounded-[14px] px-3.5 py-2.5 text-sm font-semibold", f.peerGap > 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>{A.peerLine(nm(fid), pc(f.peerGap), f.peerGap > 0)}</p>}
                </>
              )}
            </div>
          )}
        </Panel>
        <Panel title={`${A.overTime}: ${nm(fid)}`}>
          <p className="-mt-1 mb-3 text-sm text-ink-muted">{A.overTimeSub}</p>
          {series(fid).filter((v) => v !== null).length < 2 ? <EmptyNote>{A.fewMonths}</EmptyNote> : (
            <Lines labels={monthsShort.slice(span)} series={[
              { name: nm(fid), values: series(fid).slice(span), color: "var(--primary)" },
              { name: A.network, values: perf.months.map((m) => perf.network.get(m)!.lp1000).slice(span), color: "var(--ink-muted)", dashed: true },
            ]} />
          )}
        </Panel>
      </div>
    </div>
  );
}
