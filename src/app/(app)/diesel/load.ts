import "server-only";
import { redirect } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import type { Point, Tank } from "@/lib/diesel";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allocateDiesel, DEFAULT_STEAM, litersUsedBetween, type SteamSettings, type SteamType } from "@/lib/steam";

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


// ---------- diesel by machine ----------

export type SteamMachineRow = { id: number; branch_id: number; name: string; code: string; steam_type: SteamType; steam_kg_h: number | null; cycle_minutes: number | null; status: string };

/** "2026-11" for now in Riyadh, or the given month if it is valid. */
export function monthOf(m?: string | null): string {
  if (m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return m;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()).slice(0, 7);
}
export function shiftMonth(m: string, by: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const monthRange = (m: string) => {
  const from = `${m}-01`, to = `${shiftMonth(m, 1)}-01`;
  return { from, to, fromMs: Date.parse(`${from}T00:00:00+03:00`), toMs: Date.parse(`${to}T00:00:00+03:00`) };
};

export async function loadSteamSettings(supabase: SupabaseClient): Promise<SteamSettings> {
  const { data } = await supabase.from("steam_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_STEAM;
  return Object.fromEntries(Object.keys(DEFAULT_STEAM).map((k) => [k, Number(data[k])])) as SteamSettings;
}

/**
 * Each branch's diesel for a month shared between its steam machines.
 * Litres come from the tank readings of that month (or, without readings, the
 * litres delivered that month); the price from that month's invoices (or the last one).
 */
export async function loadSteamMonth(supabase: SupabaseClient, branchIds: number[], month: string) {
  const { from, to, fromMs, toMs } = monthRange(month);
  const lookBack = new Date(fromMs - 75 * 86400000).toISOString();
  const [settings, { data: mach }, { data: counts }, { data: dips }, { data: refs }] = await Promise.all([
    loadSteamSettings(supabase),
    supabase.from("equipment").select("id, branch_id, name, code, steam_type, steam_kg_h, cycle_minutes, status").in("branch_id", branchIds).not("steam_type", "is", null).order("steam_type").order("code"),
    supabase.from("steam_counts").select("equipment_id, branch_id, day, units").in("branch_id", branchIds).gte("day", from).lt("day", to),
    supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, kind").in("branch_id", branchIds).gte("read_at", lookBack).lt("read_at", new Date(toMs).toISOString()),
    supabase.from("diesel_refuels").select("branch_id, refuel_date, liters, received_liters, total_amount, price_per_liter").in("branch_id", branchIds).lt("refuel_date", to).order("refuel_date", { ascending: false }),
  ]);
  const out = new Map<number, ReturnType<typeof oneBranch>>();
  function oneBranch(b: number) {
    const machines = ((mach ?? []) as SteamMachineRow[]).filter((m) => m.branch_id === b);
    const mine = (counts ?? []).filter((c) => c.branch_id === b);
    const units = new Map<number, number>(), days = new Map<number, number>();
    for (const c of mine) { units.set(c.equipment_id, (units.get(c.equipment_id) ?? 0) + Number(c.units)); days.set(c.equipment_id, (days.get(c.equipment_id) ?? 0) + 1); }
    const daysEntered = new Set(mine.map((c) => c.day)).size;

    const used = litersUsedBetween((dips ?? []).filter((d) => d.branch_id === b), fromMs, toMs);
    const bRefs = (refs ?? []).filter((r) => r.branch_id === b);
    const monthRefs = bRefs.filter((r) => r.refuel_date >= from);
    const delivered = monthRefs.reduce((s, r) => s + Number(r.received_liters ?? r.liters), 0);
    const source: "readings" | "deliveries" | "none" = used.readings > 0 ? "readings" : delivered > 0 ? "deliveries" : "none";
    const liters = source === "readings" ? used.liters : source === "deliveries" ? Math.round(delivered * 10) / 10 : 0;
    const priced = monthRefs.filter((r) => r.total_amount !== null);
    const pl = priced.reduce((s, r) => s + Number(r.liters), 0);
    const price = pl > 0 ? priced.reduce((s, r) => s + Number(r.total_amount), 0) / pl
      : (bRefs.find((r) => r.price_per_liter !== null)?.price_per_liter ?? null);

    const result = allocateDiesel(machines.map((m) => ({ id: m.id, type: m.steam_type, units: units.get(m.id) ?? 0, kgH: m.steam_kg_h, cycleMin: m.cycle_minutes })), liters, price === null ? null : Number(price), settings);
    const byType = (t: SteamType) => {
      const rs = result.rows.filter((r) => r.type === t && r.units > 0);
      const u = rs.reduce((s, r) => s + r.units, 0);
      return u > 0 && price !== null ? rs.reduce((s, r) => s + (r.cost ?? 0), 0) / u : null;
    };
    return { machines, units, days, daysEntered, liters, source, price: price === null ? null : Number(price), result, settings, dryerUnitCost: byType("dryer"), pressUnitCost: byType("press") };
  }
  for (const b of branchIds) out.set(b, oneBranch(b));
  return out;
}
