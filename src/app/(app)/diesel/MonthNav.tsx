import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { shiftMonth } from "./perf";

export const monthLabel = (locale: Locale, m: string, long = true) =>
  new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { month: long ? "long" : "short", year: long ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

export function MonthNav({ t, locale, month, today, href }: { t: Dict; locale: Locale; month: string; today: string; href: (m: string) => string }) {
  const P = t.diesel.perf;
  const last = month >= today;
  return (
    <nav aria-label={P.month} className="flex w-fit items-center gap-1 self-start rounded-full bg-surface p-1 shadow-[0_1px_2px_rgba(27,34,53,0.06)]">
      <Button size="icon-sm" variant="ghost" render={<Link href={href(shiftMonth(month, -1))} aria-label={P.prev} />} nativeButton={false}><ChevronRightIcon className="ltr:rotate-180" /></Button>
      <span className="min-w-36 text-center text-sm font-semibold">{monthLabel(locale, month)}</span>
      <Button size="icon-sm" variant="ghost" disabled={last} render={last ? undefined : <Link href={href(shiftMonth(month, 1))} aria-label={P.next} />} nativeButton={last}><ChevronLeftIcon className="ltr:rotate-180" /></Button>
    </nav>
  );
}

/** The period of the performance pages: one month, 3 or 6 months, all months, or from – to. */
export function PeriodBar({ t, locale, period, base, action }: { t: Dict; locale: Locale; period: { kind: string; from: string; to: string }; base: string; action?: React.ReactNode }) {
  const P = t.diesel.period;
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()).slice(0, 7);
  const href = (q: string) => `${base}${base.includes("?") ? "&" : "?"}${q}`;
  const label = period.from === period.to ? monthLabel(locale, period.to) : `${monthLabel(locale, period.from, false)} ${period.from.slice(0, 4) !== period.to.slice(0, 4) ? period.from.slice(0, 4) : ""} – ${monthLabel(locale, period.to)}`;
  const step = period.kind === "1" ? 1 : Number(period.kind) || 0;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-ink-muted">{P.label}</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label={P.label}>
          {(["1", "3", "6", "all", "range"] as const).map((k) => (
            <Link key={k} href={href(k === "range" ? `p=range&from=${period.from}&to=${period.to}` : k === "all" ? "p=all" : `p=${k}&m=${period.to}`)} aria-current={period.kind === k ? "true" : undefined}
              className={`h-9 rounded-full border px-3.5 text-[13px] leading-9 font-semibold transition-colors duration-150 ${period.kind === k ? "border-primary bg-primary text-primary-foreground" : "border-hairline text-ink hover:border-primary/60"}`}>
              {P[{ "1": "one", "3": "three", "6": "six", all: "all", range: "range" }[k]]}
            </Link>
          ))}
        </div>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {step > 0 ? (
          <nav aria-label={P.label} className="flex w-fit items-center gap-1 rounded-full bg-canvas p-1">
            <Button size="icon-sm" variant="ghost" render={<Link href={href(`p=${period.kind}&m=${shiftMonth(period.to, -step)}`)} aria-label={t.diesel.perf.prev} />} nativeButton={false}><ChevronRightIcon className="ltr:rotate-180" /></Button>
            <span className="min-w-44 px-2 text-center text-sm font-semibold">{label}</span>
            <Button size="icon-sm" variant="ghost" disabled={period.to >= now} render={period.to >= now ? undefined : <Link href={href(`p=${period.kind}&m=${shiftMonth(period.to, step)}`)} aria-label={t.diesel.perf.next} />} nativeButton={period.to >= now}><ChevronLeftIcon className="ltr:rotate-180" /></Button>
          </nav>
        ) : period.kind === "all" ? (
          <span className="rounded-full bg-canvas px-4 py-2 text-sm font-semibold">{label}</span>
        ) : (
          <form method="get" action={base.split("?")[0]} className="flex flex-wrap items-end gap-2">
            {base.includes("?") && base.split("?")[1].split("&").map((kv) => { const [k, v] = kv.split("="); return <input key={k} type="hidden" name={k} value={decodeURIComponent(v ?? "")} />; })}
            <input type="hidden" name="p" value="range" />
            <label className="flex flex-col gap-1 text-[12.5px] text-ink-muted">{P.from}<input type="month" name="from" defaultValue={period.from} max={now} className="h-9 rounded-lg border border-input bg-surface px-2 text-sm text-ink" /></label>
            <label className="flex flex-col gap-1 text-[12.5px] text-ink-muted">{P.to}<input type="month" name="to" defaultValue={period.to} max={now} className="h-9 rounded-lg border border-input bg-surface px-2 text-sm text-ink" /></label>
            <Button type="submit" size="sm" variant="outline">{P.show}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
