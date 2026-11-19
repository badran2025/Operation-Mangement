import Link from "next/link";
import { AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kpi, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { shiftMonth, type loadPerformance } from "./perf";

type Perf = Awaited<ReturnType<typeof loadPerformance>>;
const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const f1 = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const f2 = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// isolated left-to-right so the sign stays in front of the number inside Arabic text
const signed = (v: number, f = f0) => { const t = f.format(Math.abs(v)); return `\u2066${/^[0.,]+$/.test(t) ? "" : v > 0 ? "+" : v < 0 ? "−" : ""}${t}\u2069`; };
export const monthLabel = (locale: Locale, m: string, long = true) =>
  new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { month: long ? "long" : "short", year: long ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
/** colour for an index where 100 = average: above 120 bad, below 80 good */
export const indexTone = (v: number | null) => (v === null ? "text-ink-muted" : v > 120 ? "text-danger" : v < 80 ? "text-success" : "text-ink");

export function MonthNav({ t, locale, month, today, href }: { t: Dict; locale: Locale; month: string; today: string; href: (m: string) => string }) {
  const P = t.diesel.perf;
  const last = month >= today;
  return (
    <nav aria-label={P.month} className="flex items-center gap-1 self-start rounded-full bg-canvas p-1">
      <Button size="icon-sm" variant="ghost" render={<Link href={href(shiftMonth(month, -1))} aria-label={P.prev} />} nativeButton={false}><ChevronRightIcon className="ltr:rotate-180" /></Button>
      <span className="min-w-36 text-center text-sm font-semibold">{monthLabel(locale, month)}</span>
      <Button size="icon-sm" variant="ghost" disabled={last} render={last ? undefined : <Link href={href(shiftMonth(month, 1))} aria-label={P.next} />} nativeButton={last}><ChevronLeftIcon className="ltr:rotate-180" /></Button>
    </nav>
  );
}

/** The why: cost = price + quantity; litres = volume (pieces) + efficiency. */
export function WhyChanged({ t, b }: { t: Dict; b: { liters: { change: number; volume: number; efficiency: number } | null; cost: { change: number; price: number; quantity: number } | null } }) {
  const P = t.diesel.perf;
  if (!b.liters && !b.cost) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] bg-surface-tint p-3.5 text-sm">
      <p className="m-0 font-semibold">{P.why}</p>
      {b.cost && <p className="num m-0">{P.costWhy(signed(b.cost.change), signed(b.cost.price), signed(b.cost.quantity))}</p>}
      {b.liters && <p className="num m-0">{P.litersWhy(signed(b.liters.change), signed(b.liters.volume), signed(b.liters.efficiency))}</p>}
      {b.liters && (b.liters.efficiency <= 0
        ? <p className="m-0 font-semibold text-success">{P.effGood(f0.format(-b.liters.efficiency))}</p>
        : <p className="m-0 font-semibold text-danger">{P.effBad(f0.format(b.liters.efficiency))}</p>)}
    </div>
  );
}

export function PerfSection({ t, locale, perf, month, today, names, isAdmin }: {
  t: Dict; locale: Locale; perf: Perf; month: string; today: string; names: Map<number, string>; isAdmin: boolean;
}) {
  const P = t.diesel.perf;
  const net = perf.network.get(month)!, prevNet = perf.network.get(shiftMonth(month, -1));
  const rows = perf.branches.map((b) => perf.at(b.id, month));
  const ranked = rows.filter((r) => r.lp1000 !== null).sort((a, b) => a.lp1000! - b.lp1000!);
  const unranked = rows.filter((r) => r.lp1000 === null);
  const maxLp = Math.max(...ranked.map((r) => r.lp1000!), 1);
  const review = rows.filter((r) => r.flags.some((f) => ["high", "rising", "price"].includes(f))).sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  const gaps = rows.filter((r) => r.flags.some((f) => ["noPieces", "partial", "noLiters"].includes(f)));
  const pct = (a: number | null | undefined, b: number | null | undefined) => (a && b ? `${signed(((a / b) - 1) * 100)}%` : null);
  const nb = perf.netBridge(month);
  const flagText = (r: (typeof rows)[number], f: string) => {
    if (f === "high" && r.index) return `${P.flags.high} (${f0.format(r.index)})`;
    if (f === "price" && r.price) return `${P.flags.price} (${f2.format(r.price)} SAR)`;
    return P.flags[f];
  };

  return (
    <Panel title={P.title} action={isAdmin && <Button size="sm" variant="outline" render={<Link href={`/diesel/months?m=${month}`} />} nativeButton={false}>{P.enter}</Button>}>
      <div className="-mt-1 mb-4 flex flex-col gap-3">
        <p className="m-0 text-sm text-ink-muted">{P.sub}</p>
        <MonthNav t={t} locale={locale} month={month} today={today} href={(m) => `/diesel?m=${m}`} />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label={P.kpi.lp1000} value={net.lp1000 === null ? "—" : f0.format(net.lp1000)} highlight />
        <Kpi label={P.kpi.cp1000} value={net.cp1000 === null ? "—" : f0.format(net.cp1000)} />
        <Kpi label={P.kpi.liters} value={net.liters ? f0.format(net.liters) : "—"} />
        <Kpi label={P.kpi.cost} value={net.cost ? f0.format(net.cost) : "—"} />
        <Kpi label={P.kpi.price} value={net.price === null ? "—" : f2.format(net.price)} />
        <Kpi label={P.kpi.pieces} value={net.pieces ? f0.format(net.pieces) : "—"} />
      </section>
      <p className="mt-2 text-[12.5px] text-ink-muted">
        {P.branchesCounted(String(net.branches))}
        {pct(net.lp1000, prevNet?.lp1000) && <> · {P.kpi.lp1000}: <b className={cn("num", (net.lp1000 ?? 0) > (prevNet?.lp1000 ?? 0) ? "text-danger" : "text-success")}>{P.vsPrev(pct(net.lp1000, prevNet?.lp1000)!)}</b></>}
      </p>

      {nb && <div className="mt-4"><WhyChanged t={t} b={nb} /></div>}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section aria-labelledby="rev-h" className="flex flex-col gap-2 rounded-[14px] bg-canvas p-3.5">
          <h3 id="rev-h" className="m-0 flex items-center gap-2 text-sm font-semibold"><AlertTriangleIcon className="size-4 text-danger" aria-hidden />{P.review}</h3>
          {review.some((r) => r.flags.includes("high")) && <p className="m-0 text-[12.5px] text-ink-muted">{P.flags.high} ({P.table.index})</p>}
          {review.length === 0 ? <p className="m-0 text-sm text-ink-muted">{P.reviewEmpty}</p> : (
            <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
              {review.map((r) => (
                <li key={r.branchId}>
                  <Link href={`/diesel/${r.branchId}?m=${month}#perf`} className="flex items-start gap-3 rounded-xl bg-danger-soft px-3 py-2 text-sm hover:underline">
                    <span className="min-w-0 flex-1">
                      <b className="font-semibold text-danger">{names.get(r.branchId)}</b>
                      {r.flags.filter((f) => ["rising", "price"].includes(f)).map((f) => <span key={f} className="block text-[12.5px] text-danger">{flagText(r, f)}</span>)}
                    </span>
                    {r.index !== null && r.flags.includes("high") && <b className="num shrink-0 text-danger" title={P.flags.high}>{f0.format(r.index)}</b>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="gap-h" className="flex flex-col gap-2 rounded-[14px] bg-canvas p-3.5">
          <h3 id="gap-h" className="m-0 flex items-center gap-2 text-sm font-semibold"><InfoIcon className="size-4 text-warning" aria-hidden />{P.dataGaps}</h3>
          {gaps.length === 0 ? <p className="m-0 text-sm text-ink-muted">—</p> : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
              {gaps.map((r) => <li key={r.branchId}><b className="font-semibold">{names.get(r.branchId)}</b>: <span className="text-ink-muted">{r.flags.filter((f) => ["noPieces", "partial", "noLiters"].includes(f)).map((f) => P.flags[f]).join(" · ")}</span></li>)}
            </ul>
          )}
        </section>
      </div>

      <div className="-mx-4 mt-4 overflow-x-auto md:-mx-5">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="text-[12.5px] text-ink-muted">
              {[P.table.branch, P.table.lp1000, P.table.index, P.table.region, P.table.change, P.table.blankets, P.table.gap, P.table.lph, P.table.liters, P.table.pieces].map((h, i) => (
                <th key={h} className={cn("h-10 px-2.5 font-semibold", i === 0 ? "ps-4 text-start md:ps-5" : i === 1 ? "text-start" : "text-end")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...ranked, ...unranked].map((r) => (
              <tr key={r.branchId} className={cn("border-t border-hairline", r.flags.includes("high") && "bg-danger-soft/40")}>
                <td className="py-2.5 ps-4 pe-2.5 md:ps-5">
                  <Link href={`/diesel/${r.branchId}?m=${month}#perf`} className="font-semibold text-primary hover:underline">{names.get(r.branchId)}</Link>
                  <span className="block text-[11.5px] text-ink-muted">{P.source[r.source]}{r.estimated && <> · <Badge variant="warning" className="h-5 px-1.5 text-[11px]">{P.estimated}</Badge></>}</span>
                </td>
                <td className="min-w-48 px-2.5">
                  {r.lp1000 !== null ? (
                    <span className="flex items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken"><span className={cn("block h-full rounded-full", (r.index ?? 0) > 120 ? "bg-danger" : (r.index ?? 100) < 80 ? "bg-success" : "bg-primary")} style={{ width: `${(r.lp1000 / maxLp) * 100}%` }} /></span>
                      <b className="num w-12 text-end font-semibold">{f0.format(r.lp1000)}</b>
                    </span>
                  ) : <span className="text-ink-muted">—</span>}
                </td>
                <td className={cn("num px-2.5 text-end font-semibold", indexTone(r.index))}>{r.index === null ? "—" : f0.format(r.index)}</td>
                <td className={cn("num px-2.5 text-end", indexTone(r.regionIndex))}>{r.regionIndex === null ? "—" : f0.format(r.regionIndex)}</td>
                <td dir="ltr" className={cn("num px-2.5 text-end rtl:text-start", r.change === null ? "text-ink-muted" : r.change > 0 ? "text-danger" : "text-success")}>{r.change === null ? "—" : `${signed(r.change)}%`}</td>
                <td className="num px-2.5 text-end">{r.blanketShare === null ? "—" : `${f1.format(r.blanketShare)}%`}</td>
                <td dir="ltr" className={cn("num px-2.5 text-end rtl:text-start", r.shareGap !== null && r.shareGap > 0.5 && "text-danger")}>{r.shareGap === null ? "—" : signed(r.shareGap, f1)}</td>
                <td className="num px-2.5 text-end">{r.lph === null ? "—" : f1.format(r.lph)}</td>
                <td className="num px-2.5 text-end">{r.liters === null ? "—" : f0.format(r.liters)}</td>
                <td className="num px-2.5 text-end">{r.pieces ? f0.format(r.pieces) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-3 rounded-[14px] bg-canvas">
        <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">ⓘ {P.table.index} · {P.table.region} · {P.table.gap} · {P.table.blankets} · {P.table.lph}</summary>
        <ul className="m-0 flex list-disc flex-col gap-1 border-t border-hairline px-3.5 py-3 ps-8 text-[13px] text-ink-muted">{P.help.map((h) => <li key={h}>{h}</li>)}</ul>
      </details>
      <p className="mt-2 text-[12px] text-ink-muted">{P.electric}</p>
    </Panel>
  );
}
