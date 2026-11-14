import type { Locale } from "./config";
import type { Dict } from "./dictionaries";

export const TZ = "Asia/Riyadh";
const intlLocale = (l: Locale) => (l === "ar" ? "ar-u-nu-latn-ca-gregory" : "en-GB");

export const nf = (l: Locale) => {
  const f = new Intl.NumberFormat(intlLocale(l));
  return (n: number | null | undefined) => f.format(Number(n ?? 0));
};

/** "09:00:00" → "9 AM" / "9 ص"; "24:00:00" → midnight */
export function formatTime(t: Dict, time: string | null | undefined): string {
  if (!time) return "—";
  const [hs, ms] = time.split(":");
  const h = Number(hs);
  const m = ms && ms !== "00" ? `:${ms}` : "";
  if ((h === 0 || h === 24) && !m) return t.ampm.midnight;
  if (h === 12 && !m) return t.ampm.noon;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m} ${h < 12 || h === 24 ? t.ampm.am : t.ampm.pm}`;
}

export type Shift = { start: string; end: string };
export function formatShifts(t: Dict, shifts: Shift[] | null | undefined): string {
  if (!shifts?.length) return "—";
  return shifts.map((s) => `${formatTime(t, s.start)} – ${formatTime(t, s.end)}`).join(" / ");
}

export function formatDaysOff(t: Dict, days: number[] | null | undefined, noDayOff?: boolean | null): string {
  if (noDayOff) return t.worker.noDayOff;
  if (!days?.length) return "—";
  return days.map((d) => t.weekdays[d]).join(t.common.comma);
}

export function formatDate(l: Locale, d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(intlLocale(l), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(d.length === 10 ? d + "T00:00:00Z" : d));
}

export function formatDateTime(l: Locale, iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(intlLocale(l), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

/** "7 Nov" (adds the year when it is not this year) */
export function formatDay(l: Locale, iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return new Intl.DateTimeFormat(intlLocale(l), { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: TZ }).format(d);
}

export function todayLabel(l: Locale, date = new Date()): string {
  return new Intl.DateTimeFormat(intlLocale(l), { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(date);
}

export function riyadhHour(date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(date));
}

export function riyadhWeekday(date = new Date()): number {
  const n = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(n);
}

export function greeting(t: Dict, date = new Date()): string {
  const h = riyadhHour(date);
  return h < 12 ? t.dashboard.greeting.morning : h < 17 ? t.dashboard.greeting.afternoon : t.dashboard.greeting.evening;
}

export function duration(t: Dict, mins: number): string {
  const m = Math.abs(mins);
  if (m < 60) return t.time.minutes(m);
  const h = Math.round(m / 60);
  if (h < 48) return t.time.hours(h);
  return t.time.days(Math.round(h / 24));
}

export function timeAgo(t: Dict, iso: string | null | undefined): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 1 ? t.time.now : t.time.ago(duration(t, mins));
}

export const OPEN_STATUSES = ["new", "assigned", "in_progress", "waiting_parts"];
/** Everything that is not finished yet (includes "fixed, awaiting confirmation") */
export const ACTIVE_STATUSES = [...OPEN_STATUSES, "resolved"];

export function dueInfo(t: Dict, due: string | null, status: string): { text: string; late: boolean } | null {
  if (!due || !OPEN_STATUSES.includes(status)) return null;
  const mins = Math.round((new Date(due).getTime() - Date.now()) / 60000);
  return mins < 0 ? { text: t.time.late(duration(t, mins)), late: true } : { text: t.time.left(duration(t, mins)), late: false };
}

export function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + "T00:00:00").getTime() - today.getTime()) / 86400000);
}
