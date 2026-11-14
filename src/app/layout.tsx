import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: "إدارة التشغيل",
  description: "نظام إدارة الفروع والعمال",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} font-sans antialiased`}>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-700">
              إدارة التشغيل
            </Link>
            <nav className="flex gap-1 text-sm font-semibold">
              <Link href="/" className="rounded-lg px-3 py-2 hover:bg-slate-100">الفروع</Link>
              <Link href="/housing" className="rounded-lg px-3 py-2 hover:bg-slate-100">السكن</Link>
              <span className="cursor-not-allowed rounded-lg px-3 py-2 text-slate-400" title="المرحلة الجاية">
                الصيانة (قريباً)
              </span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
