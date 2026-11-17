"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BuildingIcon, FileTextIcon, HomeIcon, LayoutGridIcon, MenuIcon, NetworkIcon, ShieldCheckIcon, UsersIcon, WrenchIcon, UserIcon, LogOutIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type NavKey = "overview" | "branches" | "maintenance" | "workers" | "plan" | "housing" | "documents" | "users";
const ITEMS: Record<NavKey, { href: string; icon: typeof HomeIcon }> = {
  overview: { href: "/", icon: LayoutGridIcon },
  branches: { href: "/branches", icon: BuildingIcon },
  maintenance: { href: "/maintenance", icon: WrenchIcon },
  workers: { href: "/workers", icon: UsersIcon },
  plan: { href: "/plan", icon: NetworkIcon },
  housing: { href: "/housing", icon: HomeIcon },
  documents: { href: "/documents", icon: FileTextIcon },
  users: { href: "/users", icon: ShieldCheckIcon },
};

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

export function SidebarNav({ items, overdue }: { items: NavKey[]; overdue: number }) {
  const { t } = useI18n();
  const isActive = useActive();
  return (
    <nav className="flex flex-col gap-1" aria-label={t.shell.menu}>
      {items.map((k) => {
        const { href, icon: Icon } = ITEMS[k];
        const active = isActive(href);
        return (
          <Link key={k} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex h-11 items-center gap-3 rounded-xl px-3 font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-ink",
              active && "bg-surface-tint text-accent-foreground hover:bg-surface-tint hover:text-accent-foreground")}>
            <Icon className="size-[18px]" aria-hidden />
            <span>{t.nav[k === "overview" ? "overview" : k]}</span>
            {k === "maintenance" && overdue > 0 && (
              <span className="num ms-auto rounded-full bg-danger-soft px-2 text-xs font-semibold leading-6 text-danger">{overdue}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items, overdue, userName, signOut }: { items: NavKey[]; overdue: number; userName: string; signOut: () => Promise<void> }) {
  const { t } = useI18n();
  const isActive = useActive();
  const [open, setOpen] = useState(false);
  const main = items.slice(0, 3);
  const rest = items.slice(3);
  const cell = "relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11.5px] font-medium min-h-14";
  return (
    <nav style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-30 grid print:hidden border-t border-hairline bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label={t.shell.menu}>
      {main.map((k) => {
        const { href, icon: Icon } = ITEMS[k];
        const active = isActive(href);
        return (
          <Link key={k} href={href} aria-current={active ? "page" : undefined} className={cn(cell, active ? "text-primary" : "text-ink-muted")}>
            <Icon className="size-5" aria-hidden />
            <span>{t.nav[k]}</span>
            {k === "maintenance" && overdue > 0 && <span className="num absolute top-1 start-1/2 ms-2 rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white">{overdue}</span>}
          </Link>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className={cn(cell, "text-ink-muted")}>
          <MenuIcon className="size-5" aria-hidden />
          <span>{t.shell.menu}</span>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <SheetHeader><SheetTitle>{userName}</SheetTitle></SheetHeader>
          <div className="flex flex-col gap-1 px-4">
            {rest.map((k) => {
              const { href, icon: Icon } = ITEMS[k];
              return (
                <Link key={k} href={href} onClick={() => setOpen(false)} className="flex h-12 items-center gap-3 rounded-xl px-3 font-medium hover:bg-surface-sunken">
                  <Icon className="size-5 text-ink-muted" aria-hidden />{t.nav[k]}
                </Link>
              );
            })}
            <Link href="/account" onClick={() => setOpen(false)} className="flex h-12 items-center gap-3 rounded-xl px-3 font-medium hover:bg-surface-sunken">
              <UserIcon className="size-5 text-ink-muted" aria-hidden />{t.nav.account}
            </Link>
            <form action={signOut}>
              <button className="flex h-12 w-full items-center gap-3 rounded-xl px-3 font-medium text-danger hover:bg-danger-soft">
                <LogOutIcon className="size-5" aria-hidden />{t.nav.signOut}
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

/** Kleen mark (redrawn from the official logo as SVG) + product name. */
export function KleenMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 548 549" className={cn("size-8 shrink-0 text-brand", className)} aria-hidden>
      <path fill="currentColor" fillRule="evenodd" d="M104 0h340a104 104 0 0 1 104 104v341a104 104 0 0 1-104 104H104A104 104 0 0 1 0 445V104A104 104 0 0 1 104 0zM316 150h166L233 399H66z" />
    </svg>
  );
}

export function BrandMark({ label }: { label: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <KleenMark />
      <span className="text-[17px] font-bold text-ink">{label}</span>
    </Link>
  );
}

export { BuildingIcon };
