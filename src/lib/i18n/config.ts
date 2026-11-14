export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";
export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr");
export const isLocale = (v: unknown): v is Locale => v === "en" || v === "ar";
/** Pick the localized DB field: pick(locale, row.name_ar, row.name_en) */
export const pick = (l: Locale, ar?: string | null, en?: string | null) => (l === "ar" ? ar || en : en || ar) ?? "";
