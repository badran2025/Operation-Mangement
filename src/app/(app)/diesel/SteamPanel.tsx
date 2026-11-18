import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { EmptyNote, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import type { loadSteamMonth } from "./load";
import { shiftMonth } from "./load";
import { SteamSettingsForm } from "./SteamSettingsForm";

type Month = NonNullable<ReturnType<Awaited<ReturnType<typeof loadSteamMonth>>["get"]>>;

/** The month's diesel of one branch shared between its steam machines. */
export function SteamPanel({ t, locale, branchId, month, data, isAdmin, today }: {
  t: Dict; locale: string; branchId: number; month: string; data: Month; isAdmin: boolean; today: string;
}) {
  const S = t.diesel.steam;
  const f1 = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
  const f2 = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const f3 = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
  const monthName = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const daysSoFar = month === today.slice(0, 7) ? Number(today.slice(8)) : month > today.slice(0, 7) ? 0 : daysInMonth;
  const { machines, result, liters, source, price, daysEntered } = data;
  const byId = new Map(machines.map((m) => [m.id, m]));
  const ran = result.totalKg > 0;
  const href = (m: string) => `/diesel/${branchId}?m=${m}#steam`;

  return (
    <Panel title={S.title} action={machines.length > 0 && <Button size="sm" render={<Link href={`/diesel/counts?branch=${branchId}`} />} nativeButton={false}><ClipboardListIcon data-icon="inline-start" />{S.enterCounts}</Button>}>
      <div id="steam" className="-mt-1 mb-4 flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{S.sub}</p>
        <nav aria-label={S.month} className="flex items-center gap-1 self-start rounded-full bg-canvas p-1">
          <Button size="icon-sm" variant="ghost" render={<Link href={href(shiftMonth(month, -1))} aria-label={S.prev} />} nativeButton={false}><ChevronRightIcon className="ltr:rotate-180" /></Button>
          <span className="min-w-36 text-center text-sm font-semibold">{monthName}</span>
          <Button size="icon-sm" variant="ghost" disabled={month >= today.slice(0, 7)} render={month >= today.slice(0, 7) ? undefined : <Link href={href(shiftMonth(month, 1))} aria-label={S.next} />} nativeButton={month >= today.slice(0, 7)}><ChevronLeftIcon className="ltr:rotate-180" /></Button>
        </nav>
      </div>

      {machines.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyNote>{S.noMachinesHere}</EmptyNote>
          <Button variant="outline" size="sm" render={<Link href={`/branches/${branchId}?s=equipment`} />} nativeButton={false}>{S.openEquipment}</Button>
        </div>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-[14px] bg-surface-tint p-3">
              <dt className="text-[12.5px] text-ink-muted">{S.liters}</dt>
              <dd className="num m-0 text-[20px] font-semibold">{source === "none" ? "—" : `${f1.format(liters)} L`}</dd>
              <dd className={cn("m-0 text-[12px]", source === "deliveries" ? "text-warning" : "text-ink-muted")}>{source === "readings" ? S.fromReadings : source === "deliveries" ? S.fromDeliveries : S.noDiesel}</dd>
            </div>
            <div className="rounded-[14px] bg-canvas p-3">
              <dt className="text-[12.5px] text-ink-muted">{S.price}</dt>
              <dd className="num m-0 text-[20px] font-semibold">{price === null ? "—" : `${f3.format(price)} SAR`}</dd>
              <dd className="m-0 text-[12px] text-ink-muted">{price === null ? S.noPrice : S.priceFrom}</dd>
            </div>
            <div className="rounded-[14px] bg-canvas p-3">
              <dt className="text-[12.5px] text-ink-muted">{S.card.counts}</dt>
              <dd className="num m-0 text-[20px] font-semibold">{daysEntered} / {daysSoFar}</dd>
              <dd className={cn("m-0 text-[12px]", daysEntered < daysSoFar ? "text-warning" : "text-ink-muted")}>{S.daysEntered(String(daysEntered), String(daysSoFar))}</dd>
            </div>
          </dl>

          {!ran && <p className="mb-3 rounded-[14px] bg-warning-soft px-4 py-3 text-sm font-medium text-warning">{S.nothingRan}</p>}
          <div className="-mx-4 overflow-x-auto md:-mx-5">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-[12.5px] text-ink-muted">
                  {[S.cols.machine, S.cols.units, S.cols.steam, S.cols.share, S.cols.liters, S.cols.cost, S.cols.unit].map((h, i) => (
                    <th key={h} className={cn("h-10 px-2.5 font-semibold", i === 0 ? "ps-4 text-start md:ps-5" : "text-end")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => {
                  const m = byId.get(r.id)!;
                  return (
                    <tr key={r.id} className="border-t border-hairline">
                      <td className="py-2.5 ps-4 pe-2.5 md:ps-5">
                        <span className="block font-semibold" dir="auto">{m.name}</span>
                        <span className="num text-[12px] text-ink-muted" dir="ltr">{m.code}</span>
                        <span className="text-[12px] text-ink-muted"> · {t.branchesTab.equipment.steam.types[r.type].split(" (")[0]} · {f1.format(r.kgH)} kg/h</span>
                      </td>
                      <td className="num px-2.5 text-end">{f1.format(r.units)} <span className="text-[12px] text-ink-muted">{S.unitShort[r.type]}</span></td>
                      <td className="num px-2.5 text-end">{f1.format(r.steamKg)}</td>
                      <td className="px-2.5 text-end">
                        <span className="num font-semibold">{f2.format(r.pct)}%</span>
                        <span className="ms-auto mt-1 block h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(r.pct, 100)}%` }} /></span>
                      </td>
                      <td className="num px-2.5 text-end font-semibold">{f2.format(r.liters)}</td>
                      <td className="num px-2.5 text-end">{r.cost === null ? "—" : f2.format(r.cost)}</td>
                      <td className="num px-2.5 text-end">
                        {r.unitCost !== null ? <><b className="font-semibold">{f2.format(r.unitCost)}</b> <span className="text-[12px] text-ink-muted">SAR {S.perUnit[r.type]}</span></> : "—"}
                        {r.unitLiters !== null && <span className="block text-[12px] text-ink-muted">{f3.format(r.unitLiters)} L</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-hairline font-semibold">
                  <td className="py-2.5 ps-4 md:ps-5">{S.total}</td>
                  <td />
                  <td className="num px-2.5 text-end">{f1.format(result.totalKg)}</td>
                  <td className="num px-2.5 text-end">{ran ? `${f2.format(result.totalPct)}%` : "—"}</td>
                  <td className="num px-2.5 text-end">{f2.format(result.totalLiters)}</td>
                  <td className="num px-2.5 text-end">{result.totalCost === null ? "—" : f2.format(result.totalCost)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <details className="group mt-4 rounded-[14px] bg-canvas">
        <summary className="cursor-pointer list-none px-3.5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">{S.how}</summary>
        <div className="flex flex-col gap-3 border-t border-hairline px-3.5 py-3">
          <ol className="m-0 flex list-decimal flex-col gap-1 ps-5 text-[13px] text-ink-muted">{S.howLines.map((l) => <li key={l}>{l}</li>)}</ol>
          {isAdmin && <SteamSettingsForm settings={data.settings} />}
        </div>
      </details>
    </Panel>
  );
}
