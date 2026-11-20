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
  const [{ data: branches }, { data: tanks }, { data: points }, { data: units }, { data: lastRefs }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en").neq("status", "closed").order("city_id").order("sort"),
    supabase.from("v_diesel_tank_info").select("*").eq("active", true).order("sort"),
    supabase.from("diesel_tank_points").select("tank_id, level_cm, liters"),
    supabase.from("diesel_tanks").select("id, entry_unit"),
    supabase.from("diesel_refuels").select("branch_id, price_per_liter, supplier, refuel_date, id").order("refuel_date", { ascending: false }).order("id", { ascending: false }).limit(300),
  ]);
  const { data: sups } = await supabase.from("diesel_suppliers").select("id, name, price_per_liter").eq("active", true).order("name");
  const withTank = new Set((tanks ?? []).map((x) => x.branch_id));
  const unit = new Map((units ?? []).map((u) => [u.id, u.entry_unit]));
  // the last price per litre and supplier of each branch, to start the form with
  const last: Record<number, { price: number | null; supplier: string | null }> = {};
  for (const r of lastRefs ?? []) {
    if (!last[r.branch_id]) last[r.branch_id] = { price: null, supplier: null };
    if (last[r.branch_id].price === null && r.price_per_liter !== null) last[r.branch_id].price = Number(r.price_per_liter);
    if (last[r.branch_id].supplier === null && r.supplier) last[r.branch_id].supplier = r.supplier;
  }
  return {
    branches: (branches ?? []).filter((b) => withTank.has(b.id)).map((b) => ({ id: b.id, name: pick(locale, b.name_ar, b.name_en) })),
    tanks: (tanks ?? []).map((x) => ({ ...x, entry_unit: unit.get(x.id) ?? "cm" })) as Tank[], points: (points ?? []) as Point[], last,
    suppliers: (sups ?? []).map((x) => ({ id: x.id, name: x.name, price: x.price_per_liter === null ? null : Number(x.price_per_liter) })),
  };
}
