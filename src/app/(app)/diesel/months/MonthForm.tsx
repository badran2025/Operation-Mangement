"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { NumberInput } from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { saveMonthFigures, type MonthRow } from "../actions";

type B = { id: number; name: string; pieces: number | null; orders: number | null; blankets: number | null; liters: number | null; cost: number | null; estimated: boolean; autoLiters: number | null; autoComplete: boolean; hasTanks: boolean };
const s = (v: number | null) => (v === null || v === undefined ? "" : String(v));
const shift = (m: string, by: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + by, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

export function MonthForm({ month, today, branches }: { month: string; today: string; branches: B[] }) {
  const { t, locale } = useI18n();
  const P = t.diesel.perf;
  const router = useRouter();
  const init = () => branches.map((b): MonthRow => ({ branch_id: b.id, pieces: s(b.pieces), orders: s(b.orders), blankets: s(b.blankets), liters: s(b.liters), cost: s(b.cost), estimated: b.estimated }));
  const [rows, setRows] = useState<MonthRow[]>(init);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const set = (i: number, k: keyof MonthRow, v: string | boolean) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const name = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

  return (
    <form method="post" className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { setMsg(null); const r = await saveMonthFigures(month, rows); if (r.error) setMsg({ error: r.error }); else { setMsg({ ok: P.saved }); router.refresh(); } });
    }}>
      <nav aria-label={P.month} className="flex items-center gap-1 self-start rounded-full bg-canvas p-1">
        <Button type="button" size="icon-sm" variant="ghost" aria-label={P.prev} onClick={() => router.push(`/diesel/months?m=${shift(month, -1)}`)}><ChevronRightIcon className="ltr:rotate-180" /></Button>
        <span className="min-w-36 text-center text-sm font-semibold">{name}</span>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={P.next} disabled={month >= today} onClick={() => router.push(`/diesel/months?m=${shift(month, 1)}`)}><ChevronLeftIcon className="ltr:rotate-180" /></Button>
      </nav>
      <div className="-mx-4 overflow-x-auto md:-mx-5">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-[12.5px] text-ink-muted">
              {[P.cols.branch, P.cols.pieces, P.cols.blankets, P.cols.orders, P.cols.liters, P.cols.cost, P.cols.estimate].map((h, i) => <th key={h} className={i === 0 ? "h-10 ps-4 text-start font-semibold md:ps-5" : "h-10 px-2 text-start font-semibold"}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {branches.map((b, i) => (
              <tr key={b.id} className="border-t border-hairline align-top">
                <td className="py-2.5 ps-4 pe-2 font-semibold md:ps-5">{b.name}</td>
                <td className="px-2 py-2"><NumberInput aria-label={`${b.name}: ${P.cols.pieces}`} className="w-28" value={rows[i].pieces} onChange={(e) => set(i, "pieces", e.target.value)} /></td>
                <td className="px-2 py-2"><NumberInput aria-label={`${b.name}: ${P.cols.blankets}`} className="w-24" value={rows[i].blankets} onChange={(e) => set(i, "blankets", e.target.value)} /></td>
                <td className="px-2 py-2"><NumberInput aria-label={`${b.name}: ${P.cols.orders}`} className="w-24" value={rows[i].orders} onChange={(e) => set(i, "orders", e.target.value)} /></td>
                <td className="px-2 py-2">
                  <NumberInput aria-label={`${b.name}: ${P.cols.liters}`} className="w-28" value={rows[i].liters} placeholder={b.autoLiters !== null ? nf.format(b.autoLiters) : ""} onChange={(e) => set(i, "liters", e.target.value)} />
                  <span className="mt-0.5 block text-[11.5px] text-ink-muted">{b.autoLiters !== null ? P.autoLiters(nf.format(b.autoLiters)) + (b.autoComplete ? "" : " *") : P.autoNone}</span>
                </td>
                <td className="px-2 py-2"><NumberInput aria-label={`${b.name}: ${P.cols.cost}`} className="w-28" value={rows[i].cost} onChange={(e) => set(i, "cost", e.target.value)} /></td>
                <td className="px-2 py-2.5"><input type="checkbox" aria-label={`${b.name}: ${P.cols.estimate}`} className="size-4 accent-primary" checked={rows[i].estimated} onChange={(e) => set(i, "estimated", e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-ink-muted">* {P.flags.partial}</p>
      {msg?.error && <p role="alert" className="text-sm font-semibold text-danger">{msg.error}</p>}
      {msg?.ok && <p role="status" className="text-sm font-semibold text-success">✓ {msg.ok}</p>}
      <Button type="submit" size="lg" className="self-start" disabled={busy}>{busy && <Spinner data-icon="inline-start" />}{busy ? t.common.saving : P.save}</Button>
    </form>
  );
}
