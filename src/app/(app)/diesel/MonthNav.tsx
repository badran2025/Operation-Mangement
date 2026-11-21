import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { shiftMonth } from "./perf";
import { PeriodPicker } from "./PeriodPicker";

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

/** The filter of every diesel tab: what is shown (all, a city, a branch) and the period, with arrows to step through months. */
export function PeriodBar({ t, locale, period, base, scope }: { t: Dict; locale: Locale; period: { kind: string; from: string; to: string }; base: string; scope?: React.ReactNode }) {
  const P = t.diesel.period;
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()).slice(0, 7);
  const href = (q: string) => `${base}${base.includes("?") ? "&" : "?"}${q}`;
  const label = period.from === period.to ? monthLabel(locale, period.to) : `${monthLabel(locale, period.from, false)} ${period.from.slice(0, 4) !== period.to.slice(0, 4) ? period.from.slice(0, 4) : ""} – ${monthLabel(locale, period.to)}`;
  const step = Number(period.kind) || 0;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-hairline bg-surface p-3">
      {scope}
      {scope && <span className="hidden h-7 w-px bg-hairline sm:block" aria-hidden />}
      <PeriodPicker key={`${period.kind}${period.from}${period.to}`} kind={period.kind} from={period.from} to={period.to} now={now} base={base} />
      {step > 0 ? (
        <nav aria-label={P.label} className="flex w-fit items-center gap-1 rounded-full bg-canvas p-1">
          <Button size="icon-sm" variant="ghost" render={<Link href={href(`p=${period.kind}&m=${shiftMonth(period.to, -step)}`)} aria-label={t.diesel.perf.prev} />} nativeButton={false}><ChevronRightIcon className="ltr:rotate-180" /></Button>
          <span className="min-w-40 px-2 text-center text-sm font-semibold">{label}</span>
          <Button size="icon-sm" variant="ghost" disabled={period.to >= now} render={period.to >= now ? undefined : <Link href={href(`p=${period.kind}&m=${shiftMonth(period.to, step)}`)} aria-label={t.diesel.perf.next} />} nativeButton={period.to >= now}><ChevronLeftIcon className="ltr:rotate-180" /></Button>
        </nav>
      ) : <span className="rounded-full bg-canvas px-4 py-2 text-sm font-semibold">{label}</span>}
    </div>
  );
}
