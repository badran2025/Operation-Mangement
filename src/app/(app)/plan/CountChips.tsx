"use client";
import { CalendarClockIcon, ClipboardListIcon, FileTextIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { KINDS, type Counts, type Kind } from "./tree";

export const KIND_ICON: Record<Kind, typeof FileTextIcon> = { file: FileTextIcon, review: CalendarClockIcon, action: ClipboardListIcon };

/** Small "3 files · 2 reviews · 4 actions" summary shown on map cards and list rows. */
export function CountChips({ c, className }: { c: Counts; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("flex shrink-0 items-center gap-2 text-[12px] text-ink-muted", className)}>
      {KINDS.filter((k) => c[k] > 0).map((k) => {
        const Icon = KIND_ICON[k];
        return <span key={k} className="flex items-center gap-0.5" title={t.plan.sections[k].title}><Icon className="size-3.5" aria-hidden /><span className="num">{c[k]}</span></span>;
      })}
    </span>
  );
}
