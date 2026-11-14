export const STATUS_TONE: Record<string, "info" | "warning" | "success" | "danger" | "neutral"> = {
  new: "danger", assigned: "info", in_progress: "success", waiting_parts: "warning", resolved: "success", closed: "neutral", cancelled: "neutral",
};
export const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = { urgent: "danger", high: "warning", normal: "info", low: "neutral" };
export const STATUSES = ["new", "assigned", "in_progress", "waiting_parts", "resolved", "closed", "cancelled"] as const;
export const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export type TicketRow = {
  id: number; branch_id: number; branch_ar: string; category_id: number | null; category_ar: string | null;
  title: string; description: string | null; priority: string; status: string; stops_branch: boolean;
  reported_by: string | null; reporter_display: string | null; assigned_to: string | null; assignee_display: string | null;
  assignee_contact: string | null; due_at: string | null; resolved_at: string | null; closed_at: string | null;
  last_reminder_at: string | null; legacy_ref: string | null; created_at: string; overdue: boolean;
};

/** Saudi mobile → wa.me digits */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("05")) d = "966" + d.slice(1);
  if (d.startsWith("5") && d.length === 9) d = "966" + d;
  return d.length >= 10 ? d : null;
}
