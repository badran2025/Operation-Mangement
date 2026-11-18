import Link from "next/link";
import { AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, WrenchIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyNote, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import type { loadSteam } from "./load";
import { shiftMonth } from "./load";
import { SteamSettingsForm } from "./SteamSettingsForm";
import { SteamTestForm } from "./SteamTestForm";

type Month = NonNullable<ReturnType<Awaited<ReturnType<typeof loadSteam>>["get"]>>;

/** The month's diesel of one branch shared between its steam machines, and the checks on it. */
export function SteamPanel({ t, locale, branchId, month, data, isAdmin, today }: {
  t: Dict; locale: Locale; branchId: number; month: string; data: Month; isAdmin: boolean; today: string;
}) {
  const S = t.diesel.steam;
  const C = S.check;
  const f1 = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
  const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
  const f2 = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const f3 = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
  const mName = (m: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { ...opts, timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  const { machines, result, liters, source, price, daysEntered, daysSoFar, info, trend, usual, jump, reliable } = data;
  const byId = new Map(machines.map((m) => [m.id, m]));
  const ran = result.totalKg > 0;
  const href = (m: string) => `/diesel/${branchId}?m=${m}#steam`;
  const isNow = month >= today.slice(0, 7);
  const typeName = (k: string) => t.branchesTab.equipment.steam.types[k].split(" (")[0];
  const flagged = machines.filter((m) => info.get(m.id)?.high);

  return (
    <Panel title={S.title} action={machines.length > 0 && <Button size="sm" render={<Link href={`/diesel/counts?branch=${branchId}`} />} nativeButton={false}><ClipboardListIcon data-icon="inline-start" />{S.enterCounts}</Button>}>
      <div id="steam" className="-mt-1 mb-4 flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{S.sub}</p>
        <nav aria-label={S.month} className="flex items-center gap-1 self-start rounded-full bg-canvas p-1">
          <Button size="icon-sm" variant="ghost" render={<Link href={href(shiftMonth(month, -1))} aria-label={S.prev} />} nativeButton={false}><ChevronRightIcon className="ltr:rotate-180" /></Button>
          <span className="min-w-36 text-center text-sm font-semibold">{mName(month, { month: "long", year: "numeric" })}</span>
          <Button size="icon-sm" variant="ghost" disabled={isNow} render={isNow ? undefined : <Link href={href(shiftMonth(month, 1))} aria-label={S.next} />} nativeButton={isNow}><ChevronLeftIcon className="ltr:rotate-180" /></Button>
        </nav>
      </div>

      {machines.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyNote>{S.noMachinesHere}</EmptyNote>
          <Button variant="outline" size="sm" render={<Link href={`/branches/${branchId}?s=equipment`} />} nativeButton={false}>{S.openEquipment}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* a) expected vs actual */}
          <section aria-labelledby="chk-h" className="flex flex-col gap-3">
            <h3 id="chk-h" className="text-[15px] font-semibold">{C.title}</h3>
            {jump && (
              <p role="alert" className="flex items-start gap-2 rounded-[14px] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />{C.jump(f0.format(result.unexplainedPct ?? 0), f0.format(usual ?? 0))}
              </p>
            )}
            {flagged.length > 0 && (
              <p role="alert" className="flex items-start gap-2 rounded-[14px] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />{C.testsHigh(flagged.map((m) => m.code).join("، "))}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-[14px] bg-surface-tint p-3">
                <dt className="text-[12.5px] text-ink-muted">{S.liters}</dt>
                <dd className="num m-0 text-[20px] font-semibold">{source === "none" ? "—" : `${f1.format(liters)} L`}</dd>
                <dd className={cn("m-0 text-[12px]", source === "deliveries" ? "text-warning" : "text-ink-muted")}>{source === "readings" ? S.fromReadings : source === "deliveries" ? S.fromDeliveries : S.noDiesel}</dd>
              </div>
              <div className="rounded-[14px] bg-canvas p-3">
                <dt className="text-[12.5px] text-ink-muted">{C.expected}</dt>
                <dd className="num m-0 text-[20px] font-semibold">{ran ? `${f1.format(result.expectedLiters)} L` : "—"}</dd>
                <dd className="m-0 text-[12px] text-ink-muted">{C.expectedHow(f1.format(result.totalKg), f1.format(data.settings.steam_per_liter))}</dd>
              </div>
              <div className={cn("rounded-[14px] p-3", jump ? "bg-danger-soft" : "bg-canvas")}>
                <dt className="text-[12.5px] text-ink-muted">{C.unexplained}</dt>
                <dd className={cn("num m-0 text-[20px] font-semibold", jump && "text-danger")}>{ran && source !== "none" ? `${f1.format(result.unexplained)} L` : "—"}</dd>
                <dd className="m-0 text-[12px] text-ink-muted">{ran && result.unexplainedPct !== null ? C.ofDiesel(f0.format(result.unexplainedPct)) : C.unexplainedHint}{usual !== null && <> · {C.usual(f0.format(usual))}</>}</dd>
              </div>
              <div className="rounded-[14px] bg-canvas p-3">
                <dt className="text-[12.5px] text-ink-muted">{S.price}</dt>
                <dd className="num m-0 text-[20px] font-semibold">{price === null ? "—" : `${f3.format(price)} SAR`}</dd>
                <dd className={cn("m-0 text-[12px]", daysEntered < daysSoFar ? "text-warning" : "text-ink-muted")}>{S.daysEntered(String(daysEntered), String(daysSoFar))}</dd>
              </div>
            </dl>
            {!reliable && ran && <p className="text-[12.5px] font-medium text-warning">{C.notReliable}</p>}
            <p className="text-[12.5px] text-ink-muted">{C.meaning}</p>

            {/* trend: unexplained share per month */}
            <figure className="m-0 rounded-[14px] bg-canvas p-3">
              <figcaption className="mb-2 text-[12.5px] font-semibold text-ink-muted">{C.trend}</figcaption>
              <ol className="m-0 grid list-none grid-cols-6 items-end gap-2 p-0" style={{ height: 120 }}>
                {trend.map((x) => {
                  const v = x.result.unexplainedPct;
                  const ok = x.reliable && v !== null;
                  return (
                    <li key={x.month} className="flex h-full flex-col items-center justify-end gap-1" title={ok ? `${f0.format(v!)}%` : C.noData}>
                      <span className="num text-[11.5px] font-semibold">{ok ? `${f0.format(v!)}%` : "—"}</span>
                      <span className={cn("w-full max-w-10 rounded-t-md", !ok ? "bg-surface-sunken" : x.month === month && jump ? "bg-danger" : "bg-primary/70")} style={{ height: ok ? `${Math.max(Math.min(v!, 100), 2) * 0.7}px` : "4px" }} />
                      <span className={cn("text-[11.5px] text-ink-muted", x.month === month && "font-semibold text-ink")}>{mName(x.month, { month: "short" })}</span>
                    </li>
                  );
                })}
              </ol>
            </figure>
          </section>

          {/* the split */}
          <section aria-labelledby="split-h" className="flex flex-col gap-2">
            <h3 id="split-h" className="text-[15px] font-semibold">{S.splitTitle}</h3>
            {!ran && <p className="rounded-[14px] bg-warning-soft px-4 py-3 text-sm font-medium text-warning">{S.nothingRan}</p>}
            <div className="-mx-4 overflow-x-auto md:-mx-5">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="text-[12.5px] text-ink-muted">
                    {[S.cols.machine, S.cols.units, S.cols.rate, S.cols.steam, S.cols.share, S.cols.liters, S.cols.cost, S.cols.unit].map((h, i) => (
                      <th key={h} className={cn("h-10 px-2.5 font-semibold", i === 0 ? "ps-4 text-start md:ps-5" : "text-end")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => {
                    const m = byId.get(r.id)!;
                    const inf = info.get(r.id)!;
                    const metered = m.steam_count_by === "meter";
                    return (
                      <tr key={r.id} className="border-t border-hairline">
                        <td className="py-2.5 ps-4 pe-2.5 md:ps-5">
                          <span className="block font-semibold" dir="auto">{m.name}</span>
                          <span className="num text-[12px] text-ink-muted" dir="ltr">{m.code}</span>
                          <span className="text-[12px] text-ink-muted"> · {typeName(r.type)}{metered && <> · {C.metered}</>}</span>
                        </td>
                        <td className="num px-2.5 text-end">
                          {metered ? <>{f2.format(r.steamHours)} <span className="text-[12px] text-ink-muted">{C.valveHours}</span></> : <>{f1.format(r.units)} <span className="text-[12px] text-ink-muted">{S.unitShort[r.type]}</span></>}
                        </td>
                        <td className="num px-2.5 text-end">
                          <span className={cn(inf.high && "font-semibold text-danger")}>{f1.format(r.kgH)}</span>
                          <span className="block text-[12px] text-ink-muted">{inf.catalog !== null && r.kgH === inf.catalog && !(inf.test && Number(inf.test.kg_h) === r.kgH) ? C.fromCatalog : C.fromTest}</span>
                        </td>
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
                    <td /><td />
                    <td className="num px-2.5 text-end">{f1.format(result.totalKg)}</td>
                    <td className="num px-2.5 text-end">{ran ? `${f2.format(result.totalPct)}%` : "—"}</td>
                    <td className="num px-2.5 text-end">{f2.format(result.totalLiters)}</td>
                    <td className="num px-2.5 text-end">{result.totalCost === null ? "—" : f2.format(result.totalCost)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[12.5px] text-ink-muted">{C.splitNote}</p>
          </section>

          {/* b) steam tests */}
          <section aria-labelledby="tests-h" className="flex flex-col gap-3">
            <h3 id="tests-h" className="text-[15px] font-semibold">{C.testsTitle}</h3>
            <p className="-mt-1 text-[13px] text-ink-muted">{C.testsSub}</p>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {machines.map((m) => {
                const inf = info.get(m.id)!;
                return (
                  <li key={m.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[14px] px-3.5 py-2.5 text-sm", inf.high ? "bg-danger-soft" : "bg-canvas")}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold" dir="auto"><span className="num text-ink-muted" dir="ltr">{m.code}</span> · {m.name}</span>
                      <span className="text-[12.5px] text-ink-muted">{C.catalog}: <span className="num">{inf.catalog === null ? "—" : `${f1.format(inf.catalog)} kg/h`}</span></span>
                    </span>
                    <span className="text-end text-[13px]">
                      {inf.test ? (
                        <>
                          <span dir="ltr" className="inline-flex gap-1.5">
                            <b className={cn("num font-semibold", inf.high && "text-danger")}>{f1.format(Number(inf.test.kg_h))} kg/h</b>
                            {inf.deviation !== null && <span className={cn("num font-semibold", inf.high ? "text-danger" : "text-ink-muted")}>({inf.deviation > 0 ? "+" : ""}{f0.format(inf.deviation)}%)</span>}
                          </span>
                          <span className="block text-[12px] text-ink-muted">{C.testedOn(formatDate(locale, inf.test.tested_on))}</span>
                        </>
                      ) : <span className="text-ink-muted">{C.noTest}</span>}
                    </span>
                    {inf.due && <Badge variant="warning">{inf.test ? C.due : C.never}</Badge>}
                    {inf.high && (
                      <Button size="sm" variant="outline" render={<Link href={`/maintenance/new?branch=${branchId}&equipment=${m.id}`} />} nativeButton={false}><WrenchIcon data-icon="inline-start" />{C.report}</Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <SteamTestForm branchId={branchId} machines={machines.map((m) => ({ id: m.id, label: `${m.code} · ${m.name}` }))} today={today} />
          </section>
        </div>
      )}

      <details className="group mt-5 rounded-[14px] bg-canvas">
        <summary className="cursor-pointer list-none px-3.5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">{S.how}</summary>
        <div className="flex flex-col gap-3 border-t border-hairline px-3.5 py-3">
          <ol className="m-0 flex list-decimal flex-col gap-1 ps-5 text-[13px] text-ink-muted">{[...S.howLines, ...C.howLines].map((l) => <li key={l}>{l}</li>)}</ol>
          {isAdmin && <SteamSettingsForm settings={data.settings} />}
        </div>
      </details>
    </Panel>
  );
}
