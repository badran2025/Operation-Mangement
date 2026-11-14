import Link from "next/link";
import { requireActive, ROLE_LABELS } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireActive();
  const isAdmin = profile.role === "admin";
  const links = [
    { href: "/", label: "الفروع", show: true },
    { href: "/housing", label: "السكن", show: isAdmin || profile.role === "supervisor" },
    { href: "/documents", label: "المستندات", show: isAdmin },
    { href: "/users", label: "المستخدمين", show: isAdmin },
  ].filter((l) => l.show);

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className="text-lg font-bold text-brand-700">إدارة التشغيل · كلين</Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 hover:bg-slate-100">{l.label}</Link>
            ))}
            <span className="cursor-not-allowed rounded-lg px-3 py-2 text-slate-400" title="المرحلة الجاية">الصيانة (قريباً)</span>
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/account" className="text-slate-600 hover:text-brand-700">
              {profile.full_name || profile.email} · <span className="text-slate-400">{ROLE_LABELS[profile.role]}</span>
            </Link>
            <form action={signOut}>
              <button className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">خروج</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
