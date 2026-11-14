import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page title row: optional back link, title, subtitle, actions (one primary max). */
export function PageHeader({
  title, sub, back, eyebrow, children,
}: { title: string; sub?: React.ReactNode; back?: { href: string; label: string }; eyebrow?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <ChevronRightIcon className="size-4 rotate-180 rtl:rotate-0" aria-hidden />{back.label}
          </Link>
        )}
        {eyebrow}
        <h1 className="text-[26px] font-semibold leading-tight text-ink md:text-[30px]">{title}</h1>
        {sub && <div className="mt-1 text-ink-muted">{sub}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Soft card (DESIGN.md: card, xl radius, tonal — no shadow). */
export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-surface p-4 md:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-[17px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** KPI tile: value above label. */
export function Kpi({ label, value, tone, highlight, className }: { label: string; value: React.ReactNode; tone?: "danger" | "warning"; highlight?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-xl p-4 md:p-[18px]", highlight ? "bg-surface-tint" : "bg-surface", className)}>
      <span className={cn("num text-[30px] font-semibold leading-none md:text-[34px]", tone === "danger" && "text-danger", tone === "warning" && "text-warning")}>{value}</span>
      <span className="text-[13.5px] text-ink-muted">{label}</span>
    </div>
  );
}

/** Row inside a panel (14px radius = concentric with the 20px card). */
export function SoftRow({ href, children, className }: { href?: string; children: React.ReactNode; className?: string }) {
  const cls = cn("flex items-center gap-3 rounded-[14px] bg-canvas px-3.5 py-3 transition-colors duration-150", href && "hover:bg-surface-sunken", className);
  return href ? <Link href={href} className={cls}>{children}</Link> : <div className={cls}>{children}</div>;
}

export function RowChevron() {
  return <ChevronRightIcon className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden />;
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[14px] bg-canvas px-4 py-6 text-center text-ink-muted">{children}</p>;
}
