"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LanguagesIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { setLocale } from "@/lib/i18n/actions";

export function LangToggle({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <Button
      variant="outline"
      size={compact ? "icon" : "default"}
      disabled={pending}
      aria-label={t.shell.switchLang}
      onClick={() => start(async () => { await setLocale(next); router.refresh(); })}
    >
      <LanguagesIcon data-icon="inline-start" />
      {!compact && <span lang={next}>{t.shell.switchLang}</span>}
    </Button>
  );
}

export function ThemeToggle() {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button variant="outline" size="icon" aria-label={dark ? t.shell.themeToLight : t.shell.themeToDark} onClick={() => setTheme(dark ? "light" : "dark")}>
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}
