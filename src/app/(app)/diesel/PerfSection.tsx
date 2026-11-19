import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Kpi, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { shiftMonth, type loadPerformance } from "./perf";
import { PerfTable } from "./PerfTable";
import { StatusBadge } from "./StatusBadge";

type Perf = Awaited<ReturnType<typeof loadPerformance>>;
const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
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
    <nav aria-label={P.month} className="flex w-fit items-center gap-1 self-start rounded-full bg-canvas p-1">
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
  const pct = (a: number | null | undefined, b: number | null | undefined) => (a && b ? `${signed(((a / b) - 1) * 100)}%` : null);
  const nb = perf.netBridge(month);

  return (
    <Panel action={isAdmin && <Button size="sm" variant="outline" render={<Link href={`/diesel/months?m=${month}`} />} nativeButton={false}>{P.enter}</Button>}>
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

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={t.diesel.tabs.review}>
        {(["risk", "watch", "normal", "good", "none"] as const).map((k) => {
          const c = rows.filter((r) => r.status === k).length;
          return c ? (
            <Link key={k} href={k === "risk" || k === "watch" ? `/diesel?tab=review&m=${month}` : `/diesel?tab=analysis&m=${month}`} title={t.diesel.statusHelp[k]} className="inline-flex items-center gap-1.5 rounded-full hover:opacity-80">
              <StatusBadge status={k} label={`${t.diesel.status[k]}: ${c}`} />
            </Link>
          ) : null;
        })}
      </div>

      <div className="mt-5">
        <PerfTable storageKey="diesel-perf-cols" firstHeader={P.table.branch}
          rows={[...ranked, ...unranked].map((r) => ({ key: String(r.branchId), label: names.get(r.branchId) ?? "", href: `/diesel/${r.branchId}?m=${month}`, sub: P.source[r.source], estimated: r.estimated, status: r.status, data: r }))}
          total={{ key: "total", label: P.cols2.total, sub: P.branchesCounted(String(net.branches)), data: { liters: net.liters, cost: net.cost, price: net.price, pieces: net.pieces, orders: net.orders || null, lp1000: net.lp1000, cp1000: net.cp1000, lp100orders: net.lp100orders, costPerOrder: net.costPerOrder, lph: net.lph, piecesPerOrder: net.orders ? net.pieces / net.orders : null, index: 100, change: prevNet?.lp1000 && net.lp1000 ? ((net.lp1000 / prevNet.lp1000) - 1) * 100 : null, litersChange: prevNet?.liters ? ((net.liters / prevNet.liters) - 1) * 100 : null, costChange: prevNet?.cost ? ((net.cost / prevNet.cost) - 1) * 100 : null, piecesChange: prevNet?.pieces ? ((net.pieces / prevNet.pieces) - 1) * 100 : null } }} />
      </div>
      <details className="mt-3 rounded-[14px] bg-canvas">
        <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">ⓘ {P.table.index} · {P.table.region} · {P.table.gap} · {P.table.blankets} · {P.table.lph}</summary>
        <ul className="m-0 flex list-disc flex-col gap-1 border-t border-hairline px-3.5 py-3 ps-8 text-[13px] text-ink-muted">{P.help.map((h) => <li key={h}>{h}</li>)}</ul>
      </details>
      <p className="mt-2 text-[12px] text-ink-muted">{P.electric}</p>
    </Panel>
  );
}
