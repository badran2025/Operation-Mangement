import Link from "next/link";
import { BarChart3Icon, CylinderIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/** The two parts of the diesel tab: performance, and tanks & deliveries. */
export function DieselTabs({ t, base, tab, query = "" }: { t: Dict; base: string; tab: "perf" | "tanks"; query?: string }) {
  const items = [{ key: "perf", Icon: BarChart3Icon }, { key: "tanks", Icon: CylinderIcon }] as const;
  return (
    <nav aria-label={t.diesel.title} className="flex gap-1 border-b border-hairline">
      {items.map(({ key, Icon }) => (
        <Link key={key} href={`${base}?tab=${key}${query ? `&${query}` : ""}`} aria-current={tab === key ? "page" : undefined}
          className={cn("-mb-px flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors duration-150",
            tab === key ? "border-primary text-primary" : "border-transparent text-ink-muted hover:text-ink")}>
          <Icon className="size-4" aria-hidden />{t.diesel.tabs[key]}
        </Link>
      ))}
    </nav>
  );
}
