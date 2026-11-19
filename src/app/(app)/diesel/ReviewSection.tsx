import Link from "next/link";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { EmptyNote, Panel } from "@/components/app/blocks";
import { MonthNav } from "./PerfSection";
import { StatusBadge } from "./StatusBadge";
import type { loadPerformance } from "./perf";

const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The branches that need a look this month, and the figures that are missing. */
export function ReviewSection({ t, locale, perf, month, today, names, isAdmin }: {
  t: Dict; locale: Locale; perf: Awaited<ReturnType<typeof loadPerformance>>; month: string; today: string; names: Map<number, string>; isAdmin: boolean;
}) {
  const P = t.diesel.perf;
  const rows = perf.branches.map((b) => perf.at(b.id, month));
  const review = rows.filter((r) => r.status === "risk" || r.status === "watch").sort((a, b) => (a.status === "risk" ? 0 : 1) - (b.status === "risk" ? 0 : 1) || (b.index ?? 0) - (a.index ?? 0));
  const gaps = rows.filter((r) => r.flags.some((f) => ["noPieces", "partial", "noLiters"].includes(f)));
  const net = perf.network.get(month)!;
  return (
    <div className="flex flex-col gap-4">
      <MonthNav t={t} locale={locale} month={month} today={today} href={(m) => `/diesel?tab=review&m=${m}`} />
      <Panel title={<span className="flex items-center gap-2"><AlertTriangleIcon className="size-4 text-danger" aria-hidden />{P.review} ({review.length})</span>}>
        {review.length === 0 ? <EmptyNote>{P.reviewEmpty}</EmptyNote> : (
          <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
            {review.map((r) => (
              <li key={r.branchId} className="flex flex-col gap-2 rounded-[14px] border border-hairline bg-canvas p-3.5">
                <div className="flex items-center gap-2">
                  <b className="flex-1 text-[15px] font-semibold">{names.get(r.branchId)}</b>
                  <StatusBadge status={r.status} label={t.diesel.status[r.status]} title={t.diesel.statusHelp[r.status]} />
                </div>
                <dl className="m-0 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-xl bg-surface p-2"><dt className="text-[11.5px] text-ink-muted">{P.table.lp1000}</dt><dd className="num m-0 font-semibold">{r.lp1000 === null ? "—" : f0.format(r.lp1000)}</dd></div>
                  <div className="rounded-xl bg-surface p-2"><dt className="text-[11.5px] text-ink-muted">{t.diesel.an.network}</dt><dd className="num m-0 font-semibold">{net.lp1000 === null ? "—" : f0.format(net.lp1000)}</dd></div>
                  <div className="rounded-xl bg-surface p-2"><dt className="text-[11.5px] text-ink-muted">{t.diesel.an.cols.saving}</dt><dd className="num m-0 font-semibold">{r.savingL ? `${f0.format(r.savingL)} L` : "—"}</dd></div>
                </dl>
                <ul className="m-0 flex list-disc flex-col gap-0.5 ps-5 text-[13px] text-danger">
                  {r.flags.filter((f) => ["high", "rising", "price"].includes(f)).map((f) => <li key={f}>{P.flags[f]}{f === "high" && r.index ? ` (${f0.format(r.index)})` : f === "price" && r.price ? ` (${f2.format(r.price)} SAR)` : ""}</li>)}
                  {r.trend === "worsening" && <li>{t.diesel.trend.worsening}{r.vsOwnAvg !== null && ` (+${f0.format(r.vsOwnAvg)}%)`}</li>}
                  {r.peerGap !== null && r.peerGap > 20 && <li>{t.diesel.an.peerLine(names.get(r.branchId) ?? "", f0.format(r.peerGap), true)}</li>}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" render={<Link href={`/diesel/${r.branchId}?m=${month}`} />} nativeButton={false}>{t.diesel.card.open}</Button>
                  <Button size="sm" variant="ghost" render={<Link href={`/diesel?tab=analysis&m=${month}&b=${r.branchId}#compare`} />} nativeButton={false}>{t.diesel.an.compare}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={<span className="flex items-center gap-2"><InfoIcon className="size-4 text-warning" aria-hidden />{P.dataGaps} ({gaps.length})</span>}
        action={isAdmin && gaps.length > 0 && <Button size="sm" variant="outline" render={<Link href={`/diesel/months?m=${month}`} />} nativeButton={false}>{P.enter}</Button>}>
        {gaps.length === 0 ? <EmptyNote>—</EmptyNote> : (
          <ul className="m-0 grid list-none gap-1.5 p-0 md:grid-cols-2">
            {gaps.map((r) => <li key={r.branchId} className="rounded-xl bg-canvas px-3 py-2 text-[13px]"><b className="font-semibold">{names.get(r.branchId)}</b>: <span className="text-ink-muted">{r.flags.filter((f) => ["noPieces", "partial", "noLiters"].includes(f)).map((f) => P.flags[f]).join(" · ")}</span></li>)}
          </ul>
        )}
      </Panel>
    </div>
  );
}
