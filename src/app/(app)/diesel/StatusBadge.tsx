import { AlertTriangleIcon, CheckCircle2Icon, EyeIcon, MinusCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLE: Record<string, { cls: string; Icon: typeof AlertTriangleIcon }> = {
  risk: { cls: "bg-danger-soft text-danger", Icon: AlertTriangleIcon },
  watch: { cls: "bg-warning-soft text-warning", Icon: EyeIcon },
  good: { cls: "bg-success-soft text-success", Icon: CheckCircle2Icon },
  normal: { cls: "bg-surface-sunken text-ink-muted", Icon: MinusCircleIcon },
  none: { cls: "bg-surface-sunken text-ink-muted", Icon: MinusCircleIcon },
};
/** A branch's status, always with an icon and a word (never colour alone). */
export function StatusBadge({ status, label, title }: { status: string; label: string; title?: string }) {
  const { cls, Icon } = STYLE[status] ?? STYLE.none;
  return <span title={title} className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-semibold whitespace-nowrap", cls)}><Icon className="size-3.5" aria-hidden />{label}</span>;
}
