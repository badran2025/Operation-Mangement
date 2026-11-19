import Link from "next/link";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyNote, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { indexTone, monthLabel, MonthNav, WhyChanged } from "./PerfSection";
import type { loadPerformance } from "./perf";

const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const f1 = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const f2 = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One branch: its diesel per 1,000 pieces month by month, and why the chosen month changed. */
export function BranchPerf({ t, locale, perf, branchId, month, today, isAdmin }: {
  t: Dict; locale: Locale; perf: Awaited<ReturnType<typeof loadPerformance>>; branchId: number; month: string; today: string; isAdmin: boolean;
}) {
  const P = t.diesel.perf;
  const rows = perf.months.map((m) => ({ m, r: perf.at(branchId, m), net: perf.network.get(m)! })).reverse().filter((x) => x.m === month || x.r.liters !== null || x.r.pieces);
  const cur = perf.at(branchId, month);
  const any = rows.some((x) => x.r.liters !== null || x.r.pieces);
  return (
    <Panel title={P.branchPanel} action={isAdmin && <Button size="sm" variant="outline" render={<Link href={`/diesel/months?m=${month}`} />} nativeButton={false}>{P.enter}</Button>}>
      <div id="perf" className="-mt-1 mb-4"><MonthNav t={t} locale={locale} month={month} today={today} href={(m) => `/diesel/${branchId}?m=${m}#perf`} /></div>
      {cur.flags.filter((f) => ["high", "rising", "price"].includes(f)).map((f) => (
        <p key={f} role="alert" className="mb-2 rounded-[14px] bg-danger-soft px-4 py-2.5 text-sm font-semibold text-danger">{P.flags[f]}</p>
      ))}
      {cur.bridge && <div className="mb-4"><WhyChanged t={t} b={cur.bridge} /></div>}
      {!any ? <EmptyNote>{P.noData}</EmptyNote> : (
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-[12.5px] text-ink-muted">
                {[P.month, P.table.lp1000, P.table.index, P.table.region, P.table.blankets, P.table.lph, P.table.liters, P.table.cost, P.table.pieces, P.table.hours].map((h, i) => (
                  <th key={h} className={cn("h-10 px-2.5 font-semibold", i === 0 ? "ps-4 text-start md:ps-5" : "text-end")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, r, net }) => (
                <tr key={m} className={cn("border-t border-hairline", m === month && "bg-surface-tint/60")}>
                  <td className="py-2.5 ps-4 pe-2.5 md:ps-5">
                    <span className="font-semibold">{monthLabel(locale, m)}</span>
                    <span className="block text-[11.5px] text-ink-muted">{P.source[r.source]}{r.estimated && <> · <Badge variant="warning" className="h-5 px-1.5 text-[11px]">{P.estimated}</Badge></>}</span>
                  </td>
                  <td className="px-2.5 text-end">
                    <b className="num font-semibold">{r.lp1000 === null ? "—" : f0.format(r.lp1000)}</b>
                    {net.lp1000 !== null && <span className="num block text-[11.5px] text-ink-muted">{f0.format(net.lp1000)}</span>}
                  </td>
                  <td className={cn("num px-2.5 text-end font-semibold", indexTone(r.index))}>{r.index === null ? "—" : f0.format(r.index)}</td>
                  <td className={cn("num px-2.5 text-end", indexTone(r.regionIndex))}>{r.regionIndex === null ? "—" : f0.format(r.regionIndex)}</td>
                  <td className="num px-2.5 text-end">{r.blanketShare === null ? "—" : `${f1.format(r.blanketShare)}%`}</td>
                  <td className="num px-2.5 text-end">{r.lph === null ? "—" : f1.format(r.lph)}</td>
                  <td className="num px-2.5 text-end">{r.liters === null ? "—" : f0.format(r.liters)}</td>
                  <td className="num px-2.5 text-end">{r.cost === null ? "—" : f0.format(r.cost)}{r.price !== null && <span className="block text-[11.5px] text-ink-muted">{f2.format(r.price)} / L</span>}</td>
                  <td className="num px-2.5 text-end">{r.pieces ? f0.format(r.pieces) : "—"}</td>
                  <td className="num px-2.5 text-end">{r.hours === null ? "—" : f0.format(r.hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 px-4 text-[12px] text-ink-muted md:px-5">{P.table.lp1000}: {t.diesel.perf.help[0]}</p>
        </div>
      )}
    </Panel>
  );
}
