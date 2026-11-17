import { daysUntil } from "./i18n/format";

/** Files every branch is expected to have on record. */
export const CORE_FILE_KINDS = ["baladiya", "civil_defense", "lease", "commercial_reg", "electricity", "water"] as const;
export const FILE_KINDS = [...CORE_FILE_KINDS, "snag_list", "technical_report", "other"] as const;
export const SOON_DAYS = 60;

export type FileState = "expired" | "soon" | "ok" | "none";
export function fileState(expiry: string | null | undefined): FileState {
  const d = daysUntil(expiry ?? null);
  if (d === null) return "none";
  return d < 0 ? "expired" : d <= SOON_DAYS ? "soon" : "ok";
}

export const EQUIPMENT_STATUSES = ["working", "needs_repair", "stopped", "retired"] as const;
export const EQUIPMENT_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  working: "success", needs_repair: "warning", stopped: "danger", retired: "neutral",
};
export const MATERIAL_CATEGORIES = ["chemicals", "packaging", "consumables", "tools", "other"] as const;
