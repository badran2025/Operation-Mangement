import Link from "next/link";
import { BarChart3Icon, BellIcon, CylinderIcon, TruckIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export type DieselTab = "perf" | "tanks" | "alerts" | "suppliers";
/** The parts of the diesel tab. `branch` pages have performance and tanks only. */
export function DieselTabs({ t, base, tab, query = "", reviewCount, branchName, cityName, suppliers = false }: { t: Dict; base: string; tab: DieselTab; query?: string; reviewCount?: number; branchName?: string; cityName?: string; suppliers?: boolean }) {
  const items = (false ? [] : [["perf", BarChart3Icon], ["tanks", CylinderIcon], ["alerts", BellIcon], ...(suppliers ? [["suppliers", TruckIcon]] : [])]) as [DieselTab, typeof BarChart3Icon][];
  return (
    <nav aria-label={t.diesel.title} className="-mx-1 flex gap-1 overflow-x-auto border-b border-hairline px-1">
      {items.map(([key, Icon]) => (
        <Link key={key} href={`${base}?tab=${key}${query ? `&${query}` : ""}`} aria-current={tab === key ? "page" : undefined}
          className={cn("-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150",
            tab === key ? "border-primary text-primary" : "border-transparent text-ink-muted hover:text-ink")}>
          <Icon className="size-4" aria-hidden />{key === "suppliers" || key === "alerts" ? t.diesel.tabsAll[key] : branchName ? t.diesel.tabsBranch[key](branchName) : cityName ? t.diesel.tabsCity[key](cityName) : t.diesel.tabsAll[key]}
          {key === "alerts" && reviewCount ? <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white" title={t.diesel.ov.kProblems}>{reviewCount}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
