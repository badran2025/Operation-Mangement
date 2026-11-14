export const DAYS = [
  { value: 6, label: "السبت" },
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
] as const;

export function parseDaysOff(value: string): number[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export function daysOffLabel(value: string): string {
  const set = new Set(parseDaysOff(value));
  const labels = DAYS.filter((d) => set.has(d.value)).map((d) => d.label);
  return labels.length ? labels.join("، ") : "—";
}

export function dayLabel(day: number): string {
  return DAYS.find((d) => d.value === day)?.label ?? "";
}

/** يوم الأسبوع الحالي بتوقيت السعودية (0=الأحد). غيّر المنطقة الزمنية لو لزم. */
export function todayDay(timeZone = "Asia/Riyadh"): number {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

export function isOffOn(daysOff: string, day: number): boolean {
  return parseDaysOff(daysOff).includes(day);
}

/** "08:00" -> "8:00 ص" */
export function formatTime(t: string): string {
  const [hStr, m] = t.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return t;
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m ?? "00"} ${suffix}`;
}
