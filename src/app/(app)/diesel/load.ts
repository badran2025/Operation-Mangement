import "server-only";
import { redirect } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import type { Point, Tank } from "@/lib/diesel";

/** Branches that have a tank, their tanks and calibration tables, for the diesel forms. */
export async function loadDieselForm() {
  const { supabase, profile } = await requireActive();
  if (!["admin", "supervisor"].includes(profile.role)) redirect("/");
  const { locale } = await getT();
  const [{ data: branches }, { data: tanks }, { data: points }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en").neq("status", "closed").order("city_id").order("sort"),
    supabase.from("v_diesel_tank_info").select("*").eq("active", true).order("sort"),
    supabase.from("diesel_tank_points").select("tank_id, level_cm, liters"),
  ]);
  const withTank = new Set((tanks ?? []).map((x) => x.branch_id));
  return {
    branches: (branches ?? []).filter((b) => withTank.has(b.id)).map((b) => ({ id: b.id, name: pick(locale, b.name_ar, b.name_en) })),
    tanks: (tanks ?? []) as Tank[], points: (points ?? []) as Point[],
  };
}
