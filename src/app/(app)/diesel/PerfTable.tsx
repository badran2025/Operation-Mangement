"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BranchMonth } from "./perf";
import { StatusBadge } from "./StatusBadge";

const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const f1 = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const f2 = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sgn = (v: number, f = f0) => { const t = f.format(Math.abs(v)); return `${/^[0.,]+$/.test(t) ? "" : v > 0 ? "+" : "−"}${t}`; };

type V = number | null | undefined;
type Col = { key: string; get: (r: Partial<BranchMonth>) => V; fmt: (v: number) => string; tone?: (v: number) => string };
const idx = (v: number) => (v > 120 ? "text-danger font-semibold" : v < 80 ? "text-success font-semibold" : "font-semibold");
const up = (v: number) => (v > 0 ? "text-danger" : v < 0 ? "text-success" : "");
const pct = (v: number) => `${sgn(v)}%`;

/** Every measure from the diesel analysis sheet, in groups. */
const GROUPS: { key: string; cols: Col[] }[] = [
  { key: "diesel", cols: [
    { key: "liters", get: (r) => r.liters, fmt: (v) => f0.format(v) },
    { key: "cost", get: (r) => r.cost, fmt: (v) => f0.format(v) },
    { key: "price", get: (r) => r.price, fmt: (v) => f2.format(v) },
    { key: "priceVsRegion", get: (r) => r.priceVsRegion, fmt: pct, tone: (v) => (Math.abs(v) > 5 ? "text-danger" : "") },
  ] },
  { key: "work", cols: [
    { key: "pieces", get: (r) => r.pieces, fmt: (v) => f0.format(v) },
    { key: "orders", get: (r) => r.orders, fmt: (v) => f0.format(v) },
    { key: "piecesPerOrder", get: (r) => r.piecesPerOrder, fmt: (v) => f1.format(v) },
    { key: "blanketShare", get: (r) => r.blanketShare, fmt: (v) => `${f1.format(v)}%` },
  ] },
  { key: "efficiency", cols: [
    { key: "lp1000", get: (r) => r.lp1000, fmt: (v) => f0.format(v) },
    { key: "cp1000", get: (r) => r.cp1000, fmt: (v) => f0.format(v) },
    { key: "lp100orders", get: (r) => r.lp100orders, fmt: (v) => f0.format(v) },
    { key: "costPerOrder", get: (r) => r.costPerOrder, fmt: (v) => f2.format(v) },
  ] },
  { key: "hours", cols: [
    { key: "perDay", get: (r) => r.hours?.perDay, fmt: (v) => f1.format(v) },
    { key: "stopped", get: (r) => r.hours?.stopped, fmt: (v) => f1.format(v), tone: (v) => (v > 0 ? "text-warning" : "") },
    { key: "actual", get: (r) => r.hours?.actual, fmt: (v) => f0.format(v) },
    { key: "lph", get: (r) => r.lph, fmt: (v) => f2.format(v) },
    { key: "cph", get: (r) => r.cph, fmt: (v) => f2.format(v) },
  ] },
  { key: "compare", cols: [
    { key: "index", get: (r) => r.index, fmt: (v) => f0.format(v), tone: idx },
    { key: "regionIndex", get: (r) => r.regionIndex, fmt: (v) => f0.format(v), tone: idx },
    { key: "shareGap", get: (r) => r.shareGap, fmt: (v) => sgn(v, f1), tone: (v) => (v > 0.5 ? "text-danger" : "") },
  ] },
  { key: "change", cols: [
    { key: "change", get: (r) => r.change, fmt: pct, tone: up },
    { key: "litersChange", get: (r) => r.litersChange, fmt: pct, tone: up },
    { key: "costChange", get: (r) => r.costChange, fmt: pct, tone: up },
    { key: "piecesChange", get: (r) => r.piecesChange, fmt: pct },
  ] },
  { key: "tank", cols: [
    { key: "capacity", get: (r) => r.capacity, fmt: (v) => f0.format(v) },
    { key: "turnover", get: (r) => r.turnover, fmt: (v) => `${f1.format(v)}×` },
    { key: "coverDays", get: (r) => r.coverDays, fmt: (v) => f1.format(v) },
  ] },
  { key: "equipment", cols: [
    { key: "dryers", get: (r) => r.dryers, fmt: (v) => f0.format(v) },
    { key: "presses", get: (r) => r.presses, fmt: (v) => f0.format(v) },
  ] },
];
const DEFAULT_ON = ["diesel", "work", "efficiency", "hours", "compare", "change", "tank", "equipment"];

export type PerfRow = { key: string; label: string; href?: string; sub?: string; estimated?: boolean; highlight?: boolean; status?: string; data: Partial<BranchMonth> };

export function PerfTable({ rows, total, firstHeader, storageKey }: { rows: PerfRow[]; total?: PerfRow; firstHeader: string; storageKey: string }) {
  const { t } = useI18n();
  const C = t.diesel.perf.cols2;
  const [on, setOn] = useState<string[]>(DEFAULT_ON);
  useEffect(() => {
    try { const v = localStorage.getItem(storageKey); if (v) setOn(JSON.parse(v)); } catch { /* storage may be blocked */ }
  }, [storageKey]);
  const toggle = (k: string) => setOn((cur) => {
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const groups = GROUPS.filter((g) => on.includes(g.key));
  const cell = (c: Col, r: Partial<BranchMonth>) => {
    const v = c.get(r);
    if (v === null || v === undefined || !Number.isFinite(v)) return <span className="text-ink-muted">—</span>;
    return <span className={c.tone?.(v)}>{c.fmt(v)}</span>;
  };
  const line = (r: PerfRow, isTotal = false) => (
    <tr key={r.key} className={cn("border-t border-hairline", r.highlight && "bg-surface-tint/60", isTotal && "border-t-2 bg-canvas font-semibold")}>
      <th scope="row" className={cn("sticky start-0 z-10 min-w-40 bg-surface py-2.5 ps-4 pe-3 text-start font-normal md:ps-5", isTotal && "bg-canvas", r.highlight && "bg-surface-tint")}>
        <span className="flex flex-wrap items-center gap-1.5">
          {r.href ? <Link href={r.href} className="font-semibold text-primary hover:underline">{r.label}</Link> : <span className="font-semibold">{r.label}</span>}
          {r.status && r.status !== "normal" && r.status !== "none" && <StatusBadge status={r.status} label={t.diesel.status[r.status]} title={t.diesel.statusHelp[r.status]} />}
        </span>
        {(r.sub || r.estimated) && <span className="block text-[11.5px] text-ink-muted">{r.sub}{r.estimated && <> · <Badge variant="warning" className="h-5 px-1.5 text-[11px]">{t.diesel.perf.estimated}</Badge></>}</span>}
      </th>
      {groups.map((g) => g.cols.map((c, i) => (
        <td key={c.key} dir="ltr" className={cn("num px-2.5 text-end rtl:text-start", i === 0 && "border-s border-hairline")}>{cell(c, r.data)}</td>
      )))}
    </tr>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={C.show}>
        <span className="text-[12.5px] text-ink-muted">{C.show}:</span>
        {GROUPS.map((g) => (
          <button key={g.key} type="button" aria-pressed={on.includes(g.key)} onClick={() => toggle(g.key)}
            className={cn("h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-150",
              on.includes(g.key) ? "border-primary bg-surface-tint text-primary" : "border-hairline text-ink-muted hover:border-primary/50")}>
            {C.groups[g.key]}
          </button>
        ))}
      </div>
      <div className="-mx-4 overflow-x-auto md:-mx-5">
        <table className="w-max min-w-full text-sm">
          <thead>
            <tr className="text-[12px] text-ink-muted">
              <th rowSpan={2} className="sticky start-0 z-10 bg-surface ps-4 pe-3 text-start font-semibold md:ps-5">{firstHeader}</th>
              {groups.map((g) => <th key={g.key} colSpan={g.cols.length} className="h-8 border-s border-hairline px-2.5 text-center font-semibold text-ink">{C.groups[g.key]}</th>)}
            </tr>
            <tr className="text-[11.5px] text-ink-muted">
              {groups.map((g) => g.cols.map((c, i) => (
                <th key={c.key} className={cn("h-10 max-w-28 px-2.5 text-end align-bottom font-medium leading-4 rtl:text-start", i === 0 && "border-s border-hairline")}>{C.c[c.key]}</th>
              )))}
            </tr>
          </thead>
          <tbody>{rows.map((r) => line(r))}</tbody>
          {total && <tfoot>{line(total, true)}</tfoot>}
        </table>
      </div>
    </div>
  );
}
