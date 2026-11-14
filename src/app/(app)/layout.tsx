import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { BottomNav, BrandMark, SidebarNav, type NavKey } from "@/components/app/nav";
import { LangToggle, ThemeToggle } from "@/components/app/toggles";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, supabase } = await requireActive();
  const { t } = await getT();
  const role = profile.role;
  const items: NavKey[] =
    role === "admin" ? ["overview", "maintenance", "workers", "housing", "documents", "users"]
    : role === "supervisor" ? ["overview", "maintenance", "workers", "housing"]
    : ["maintenance"];
  const { count: overdue } = await supabase.from("v_tickets").select("id", { count: "exact", head: true }).eq("overdue", true);
  const name = profile.full_name || profile.email || "";

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">{t.nav.skip}</a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-e border-hairline bg-surface px-3 py-5 md:flex">
        <BrandMark label={t.brand} />
        <SidebarNav items={items} overdue={overdue ?? 0} />
        <div className="mt-auto flex flex-col gap-1 border-t border-hairline pt-3">
          <Link href="/account" className="flex flex-col rounded-xl px-3 py-2 hover:bg-surface-sunken">
            <span className="truncate font-medium text-ink">{name}</span>
            <span className="truncate text-[13px] text-ink-muted">{t.roles[role]}</span>
          </Link>
          <form action={signOut}>
            <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <LogOutIcon className="size-4 rtl:-scale-x-100" aria-hidden />{t.nav.signOut}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 bg-canvas/85 px-4 backdrop-blur-md md:px-7">
          <div className="md:hidden"><BrandMark label={t.brand} /></div>
          <div className="ms-auto flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 px-4 pb-8 pt-2 md:px-7">{children}</main>
      </div>

      <BottomNav items={items} overdue={overdue ?? 0} userName={name} signOut={signOut} />
    </div>
  );
}
