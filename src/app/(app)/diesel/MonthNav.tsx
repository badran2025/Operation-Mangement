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
