import Link from "next/link";
import { AlertTriangleIcon, ArrowDownRightIcon, ArrowUpRightIcon, CheckCircle2Icon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyNote, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { STATUS_COLOR } from "./Charts";
import { MonthNav } from "./MonthNav";
import { StatusBadge } from "./StatusBadge";
import { shiftMonth, type BranchMonth, type loadPerformance } from "./perf";

type Perf = Awaited<ReturnType<typeof loadPerformance>>;
export const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const f1 = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const f2 = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const abs = (v: number) => f0.format(Math.abs(v));
const pctOf = (a: number | null | undefined, b: number | null | undefined) => (a !== null && a !== undefined && b ? ((a / b) - 1) * 100 : null);
/** "89% more than" or "2.3×" */
export const howMuch = (t: Dict, ratio: number) => (ratio >= 2 ? t.diesel.ov.times(f1.format(ratio)) : t.diesel.ov.more(f0.format((ratio - 1) * 100)));

/** A big number with one line under it. */
export function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-hairline bg-surface p-4">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className={cn("num text-[28px] leading-9 font-semibold", tone === "bad" && "text-danger", tone === "good" && "text-success")}>{value}</span>
      {sub && <span className="text-[12.5px] text-ink-muted">{sub}</span>}
    </div>
  );
}
export function Change({ v, t }: { v: number | null; t: Dict }) {
  if (v === null) return <>{t.diesel.ov.noLast}</>;
  if (Math.abs(v) < 0.5) return <span className="num font-semibold">0%</span>;
  const Icon = v > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  return <span className={cn("inline-flex items-center gap-0.5 font-semibold", v > 0 ? "text-danger" : "text-success")}><Icon className="size-3.5" aria-hidden /><span className="num">{abs(v)}%</span></span>;
}

/** The few things worth knowing this month, most important first. */
function alertsFor(t: Dict, perf: Perf, month: string, nm: (id: number) => string) {
  const O = t.diesel.ov;
  const net = perf.network.get(month)!;
  const ok = perf.branches.map((b) => perf.at(b.id, month)).filter((r) => r.valid && !r.estimated);
  const out: { id: number; bad: boolean; text: string; weight: number }[] = [];
  const used = new Set<number>();
  for (const r of ok.filter((x) => x.status === "risk" || (x.index ?? 0) > 120).sort((a, b) => (b.savingL ?? 0) - (a.savingL ?? 0))) {
    const x = howMuch(t, r.lp1000! / net.lp1000!);
    out.push({ id: r.branchId, bad: true, weight: 1000 + (r.savingL ?? 0), text: r.change !== null && r.change > 5 ? O.highWorse(nm(r.branchId), x, f0.format(r.lp1000!), abs(r.change)) : O.high(nm(r.branchId), x, f0.format(r.lp1000!)) });
    used.add(r.branchId);
  }
  // the biggest gap between two branches doing similar work
  let pair: [BranchMonth, BranchMonth] | null = null, ratio = 1;
  for (const a of ok) for (const b of ok) if (a !== b && Math.abs(a.pieces! / b.pieces! - 1) <= 0.25 && a.lp1000! / b.lp1000! > ratio) { ratio = a.lp1000! / b.lp1000!; pair = [a, b]; }
  if (pair && ratio >= 1.5) out.push({ id: pair[0].branchId, bad: true, weight: 0, text: O.pair(nm(pair[0].branchId), nm(pair[1].branchId), howMuch(t, ratio), f0.format(pair[0].pieces!), f0.format(pair[1].pieces!)) });
  for (const r of ok.filter((x) => !used.has(x.branchId) && x.change !== null && x.change > 10).sort((a, b) => b.change! - a.change!)) out.push({ id: r.branchId, bad: true, weight: 500 + r.change!, text: O.worse(nm(r.branchId), abs(r.change!)) });
  for (const r of ok.filter((x) => x.priceVsRegion !== null && x.priceVsRegion > 5)) out.push({ id: r.branchId, bad: true, weight: 400, text: O.price(nm(r.branchId), abs(r.priceVsRegion!)) });
  const best = ok.filter((x) => x.change !== null && x.change < -10).sort((a, b) => a.change! - b.change!)[0];
  if (best) out.push({ id: best.branchId, bad: false, weight: 100, text: O.better(nm(best.branchId), abs(best.change!)) });
  // the two biggest problems, then the pair of similar branches, then the rest
  const ranked = out.filter((a) => a.bad && a.weight > 0).sort((a, b) => b.weight - a.weight);
  const pairAlert = out.find((a) => a.bad && a.weight === 0);
  const bad = [...ranked.slice(0, 2), ...(pairAlert ? [pairAlert] : []), ...ranked.slice(2)].slice(0, best ? 4 : 5);
  return [...bad, ...out.filter((a) => !a.bad)];
}

/** Bars of litres per 1,000 pieces, worst first, coloured by status, with the network average. */
function StatusBars({ t, rows, avg, nm, href }: { t: Dict; rows: BranchMonth[]; avg: number | null; nm: (id: number) => string; href: (id: number) => string }) {
  const max = Math.max(...rows.map((r) => r.lp1000!), avg ?? 0) * 1.05;
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <Link key={r.branchId} href={href(r.branchId)} className="group grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3 rounded-lg px-1 py-0.5 text-sm hover:bg-surface-tint/60 sm:grid-cols-[10rem_1fr_3.5rem]"
          title={`${nm(r.branchId)}: ${f0.format(r.lp1000!)} · ${t.diesel.status[r.status]}`}>
          <span className="truncate font-medium group-hover:text-primary">{nm(r.branchId)}</span>
          <span className="relative h-4">
            <span className="absolute inset-y-0 start-0 rounded-e-[4px]" style={{ width: `${(r.lp1000! / max) * 100}%`, background: STATUS_COLOR[r.status] }} />
            {avg && <span className="absolute -inset-y-1 w-0.5 bg-ink" style={{ insetInlineStart: `${(avg / max) * 100}%` }} aria-hidden />}
          </span>
          <span className="num text-end font-semibold">{f0.format(r.lp1000!)}</span>
        </Link>
      ))}
      {avg && <p className="m-0 mt-1 flex items-center gap-2 text-[12.5px] text-ink-muted"><span className="h-3.5 w-0.5 bg-ink" aria-hidden />{t.diesel.ov.avg}: <b className="num">{f0.format(avg)}</b></p>}
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
        {(["risk", "watch", "normal", "good"] as const).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: STATUS_COLOR[k] }} aria-hidden />{t.diesel.status[k]}</span>)}
      </p>
    </div>
  );
}

export type Row = { key: string; label: string; href?: string; data: BranchMonth | Partial<BranchMonth>; total?: boolean; highlight?: boolean };
/** The 10 diesel columns. */
export function DieselTable({ t, rows, first }: { t: Dict; rows: Row[]; first: string }) {
  const C = t.diesel.ov.cols;
  const n = (v: number | null | undefined, f = f0) => (v === null || v === undefined ? <span className="text-ink-muted">—</span> : f.format(v));
  return (
    <div className="-mx-4 overflow-x-auto md:-mx-5">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="text-[12.5px] text-ink-muted">
            {[first, C.status, C.lp, C.change, C.liters, C.cost, C.price, C.pieces, C.blankets, C.lph].map((h, i) => (
              <th key={h} className={cn("h-10 px-2.5 font-semibold", i === 0 ? "ps-4 text-start md:ps-5" : i === 1 ? "text-start" : "text-end")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.data;
            return (
              <tr key={r.key} className={cn("border-t border-hairline", r.total && "border-t-2 bg-canvas font-semibold", r.highlight && "bg-surface-tint/60")}>
                <td className="py-2.5 ps-4 pe-2.5 md:ps-5">
                  {r.href ? <Link href={r.href} className="font-semibold text-primary hover:underline">{r.label}</Link> : <span className="font-semibold">{r.label}</span>}
                  {d.estimated && <Badge variant="warning" className="ms-2 h-5 px-1.5 text-[11px]">{t.diesel.perf.estimated}</Badge>}
                </td>
                <td className="px-2.5">{!r.total && !d.estimated && d.status && <StatusBadge status={d.status} label={t.diesel.status[d.status]} title={t.diesel.statusHelp[d.status]} />}</td>
                <td className="num px-2.5 text-end text-[15px] font-semibold">{n(d.lp1000)}</td>
                <td className="px-2.5 text-end">{d.change === null || d.change === undefined ? <span className="text-ink-muted">—</span> : <Change v={d.change} t={t} />}</td>
                <td className="num px-2.5 text-end">{n(d.liters)}</td>
                <td className="num px-2.5 text-end">{n(d.cost)}</td>
                <td className="num px-2.5 text-end">{n(d.price, f2)}</td>
                <td className="num px-2.5 text-end">{n(d.pieces)}</td>
                <td className="num px-2.5 text-end">{d.blanketShare === null || d.blanketShare === undefined ? <span className="text-ink-muted">—</span> : `${f1.format(d.blanketShare)}%`}</td>
                <td className="num px-2.5 text-end">{n(d.lph, f1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The diesel performance page: four numbers, the alerts, one chart, the table, what is missing. */
export function Overview({ t, locale, perf, month, today, names, isAdmin }: { t: Dict; locale: Locale; perf: Perf; month: string; today: string; names: Map<number, string>; isAdmin: boolean }) {
  const O = t.diesel.ov, P = t.diesel.perf;
  const nm = (id: number) => names.get(id) ?? "";
  const href = (id: number) => `/diesel/${id}?m=${month}`;
  const net = perf.network.get(month)!, prev = perf.network.get(shiftMonth(month, -1));
  const rows = perf.branches.map((b) => perf.at(b.id, month));
  const ok = rows.filter((r) => r.valid && !r.estimated);
  const risk = ok.filter((r) => r.status === "risk").length, watch = ok.filter((r) => r.status === "watch").length;
  const saveL = ok.reduce((s, r) => s + (r.savingL ?? 0), 0), saveSAR = ok.reduce((s, r) => s + (r.savingSAR ?? 0), 0);
  const alerts = alertsFor(t, perf, month, nm);
  const ranked = rows.filter((r) => r.lp1000 !== null).sort((a, b) => b.lp1000! - a.lp1000!);
  const missing = rows.filter((r) => r.flags.some((f) => ["noPieces", "partial", "noLiters"].includes(f)));
  const lpChange = pctOf(net.lp1000, prev?.lp1000);
  // the month's diesel cost counts every branch with figures, even before its pieces are entered
  const costOf = (m: string) => perf.branches.reduce((s, b) => { const x = perf.at(b.id, m); return s + (x.source !== "partial" && x.cost !== null ? x.cost : 0); }, 0);
  const allCost = costOf(month), prevCost = perf.months.includes(shiftMonth(month, -1)) ? costOf(shiftMonth(month, -1)) : 0;
  const allCostChange = pctOf(allCost, prevCost);

  return (
    <div className="flex flex-col gap-4">
      <MonthNav t={t} locale={locale} month={month} today={today} href={(m) => `/diesel?m=${m}`} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={O.kLp} value={net.lp1000 === null ? "—" : f0.format(net.lp1000)} sub={<Change v={lpChange} t={t} />} />
        <Tile label={O.kCost} value={allCost ? `${f0.format(allCost)}` : "—"} sub={allCostChange === null ? O.noLast : <>SAR · <Change v={allCostChange} t={t} /></>} />
        <Tile label={O.kProblems} value={ok.length ? f0.format(risk + watch) : "—"} tone={risk ? "bad" : undefined} sub={O.problemsSub(String(risk), String(watch))} />
        <Tile label={O.kSaving} value={saveL ? `${f0.format(saveL)} L` : "—"} tone={saveL ? "good" : undefined} sub={saveSAR ? O.savingSub(f0.format(saveSAR)) : undefined} />
      </section>

      <Panel title={O.alerts}>
        {alerts.length === 0 ? <EmptyNote>{O.noAlerts}</EmptyNote> : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {alerts.map((a, i) => (
              <li key={i}>
                <Link href={href(a.id)} className={cn("flex items-start gap-3 rounded-[14px] px-4 py-3 text-[15px] leading-7 hover:underline", a.bad ? "bg-danger-soft" : "bg-success-soft")}>
                  {a.bad ? <AlertTriangleIcon className="mt-1.5 size-4 shrink-0 text-danger" aria-hidden /> : <CheckCircle2Icon className="mt-1.5 size-4 shrink-0 text-success" aria-hidden />}
                  <span className="num">{a.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={O.chart}>
        <p className="-mt-1 mb-3 text-sm text-ink-muted">{O.chartSub}</p>
        {ranked.length === 0 ? <EmptyNote>{P.noData}</EmptyNote> : <StatusBars t={t} rows={ranked} avg={net.lp1000} nm={nm} href={href} />}
      </Panel>

      <Panel title={O.table} action={isAdmin && <Button size="sm" variant="outline" render={<Link href={`/diesel/months?m=${month}`} />} nativeButton={false}>{P.enter}</Button>}>
        <DieselTable t={t} first={O.cols.branch}
          rows={[...ranked, ...rows.filter((r) => r.lp1000 === null)].map((r) => ({ key: String(r.branchId), label: nm(r.branchId), href: href(r.branchId), data: r }))
            .concat(ok.length ? [{ key: "total", label: O.total, total: true, data: { liters: net.liters, cost: net.cost, price: net.price, pieces: net.pieces, lp1000: net.lp1000, lph: net.lph, change: lpChange } as Partial<BranchMonth> } as never] : [])} />
        {missing.length > 0 && (
          <p className="mt-4 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[14px] bg-warning-soft px-4 py-2.5 text-[13px] text-warning">
            <b className="font-semibold">{O.missing}:</b>
            {missing.map((r) => nm(r.branchId)).join("، ")}
            {isAdmin && <Link href={`/diesel/months?m=${month}`} className="ms-auto font-semibold underline">{O.enter}</Link>}
          </p>
        )}
      </Panel>
    </div>
  );
}
