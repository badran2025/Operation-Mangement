// Weekday convention: 0 = Sunday ... 6 = Saturday (same as the database)
export const WEEKDAYS = [
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
] as const;

export const dayLabel = (d: number) => WEEKDAYS.find((w) => w.value === d)?.label ?? "";

export function riyadhWeekday(date = new Date()): number {
  const n = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Riyadh" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(n);
}

/** "09:00:00" -> "9 ص", "24:00:00" -> "12 ليلاً", "12:30:00" -> "12:30 ظهراً" */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  const [hs, ms] = t.split(":");
  const h = Number(hs);
  const m = ms && ms !== "00" ? `:${ms}` : "";
  if (h === 0 || h === 24) return `12${m} ليلاً`;
  if (h === 12) return `12${m} ظهراً`;
  return h < 12 ? `${h}${m} ص` : `${h - 12}${m} م`;
}

export type Shift = { start: string; end: string };
export function formatShifts(shifts: Shift[] | null | undefined): string {
  if (!shifts || shifts.length === 0) return "—";
  return shifts.map((s) => `${formatTime(s.start)} – ${formatTime(s.end)}`).join(" / ");
}

export function formatDaysOff(days: number[] | null | undefined, noDayOff?: boolean | null): string {
  if (noDayOff) return "بدون إجازة";
  if (!days || days.length === 0) return "—";
  return days.map(dayLabel).join("، ");
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(d + (d.length === 10 ? "T00:00:00Z" : "")),
  );
}

export function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  today.setHours(0, 0, 0, 0);
  const target = new Date(d + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export const STATUS_LABELS: Record<string, string> = {
  active: "على رأس العمل",
  on_leave: "في إجازة",
  terminated: "منتهي",
};

export const DOC_LABELS: Record<string, string> = {
  iqama: "الإقامة",
  passport: "جواز السفر",
  insurance: "التأمين الطبي",
  contract: "عقد العمل",
  baladiya: "كرت البلدية",
  medical: "الكشف الطبي",
};

export const JOB_AR: Record<string, string> = {};
