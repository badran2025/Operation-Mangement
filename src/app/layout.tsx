import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/client";
import { dirOf } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import "./globals.css";

// English: Work Sans (OFL). Arabic: Firjar (OFL), subset to Arabic code points only,
// so Latin text always renders in Work Sans and Arabic always in Firjar.
const workSans = localFont({ src: "./fonts/WorkSans-VF.woff2", weight: "250 900", variable: "--font-work-sans", display: "swap" });
const firjar = localFont({ src: "./fonts/Firjar-Arabic-VF.woff2", weight: "100 800", variable: "--font-firjar", display: "swap" });

export const metadata: Metadata = { title: "Kleen Ops", description: "Kleen operations: branches, workers and maintenance" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = dirOf(locale);
  return (
    <html lang={locale} dir={dir} className={cn(workSans.variable, firjar.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <DirectionProvider direction={dir}>
            <I18nProvider locale={locale}>
              <TooltipProvider>
                {children}
                <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} />
              </TooltipProvider>
            </I18nProvider>
          </DirectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
