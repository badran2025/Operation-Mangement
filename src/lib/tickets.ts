export const TICKET_STATUS: Record<string, { label: string; tone: "gray" | "green" | "amber" | "red" | "blue" }> = {
  new: { label: "جديد", tone: "red" },
  assigned: { label: "متحوّل لفني", tone: "blue" },
  in_progress: { label: "جاري التنفيذ", tone: "amber" },
  waiting_parts: { label: "مستني قطع غيار", tone: "amber" },
  resolved: { label: "اتحل · مستني تأكيد", tone: "green" },
  closed: { label: "مقفول", tone: "gray" },
  cancelled: { label: "ملغي", tone: "gray" },
};

export const PRIORITY: Record<string, { label: string; hint: string; tone: "gray" | "amber" | "red" | "blue" }> = {
  urgent: { label: "عاجل", hint: "خلال 4 ساعات", tone: "red" },
  high: { label: "عالي", hint: "خلال 24 ساعة", tone: "amber" },
  normal: { label: "عادي", hint: "خلال 3 أيام", tone: "blue" },
  low: { label: "منخفض", hint: "خلال أسبوع", tone: "gray" },
};

export const OPEN_STATUSES = ["new", "assigned", "in_progress", "waiting_parts"];

export type TicketRow = {
  id: number; branch_id: number; branch_ar: string; category_id: number | null; category_ar: string | null;
  title: string; description: string | null; priority: string; status: string; stops_branch: boolean;
  reported_by: string | null; reporter_display: string | null; assigned_to: string | null; assignee_display: string | null;
  assignee_contact: string | null; due_at: string | null; resolved_at: string | null; closed_at: string | null;
  last_reminder_at: string | null; legacy_ref: string | null; created_at: string; overdue: boolean;
};

const TZ = "Asia/Riyadh";
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

/** "منذ 3 ساعات" / "منذ يومين" */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 1 ? "الآن" : "منذ " + duration(mins);
}

export function duration(mins: number): string {
  const m = Math.abs(mins);
  if (m < 60) return `${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} ساعة`;
  return `${Math.round(h / 24)} يوم`;
}

export function dueLabel(t: Pick<TicketRow, "due_at" | "status">): string | null {
  if (!t.due_at || !OPEN_STATUSES.includes(t.status)) return null;
  const mins = Math.round((new Date(t.due_at).getTime() - Date.now()) / 60000);
  return mins < 0 ? `متأخر ${duration(mins)}` : `باقي ${duration(mins)}`;
}

/** Saudi mobile → wa.me digits */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("05")) d = "966" + d.slice(1);
  if (d.startsWith("5") && d.length === 9) d = "966" + d;
  return d.length >= 10 ? d : null;
}
