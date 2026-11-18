import "server-only";
import { redirect } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import type { Point, Tank } from "@/lib/diesel";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allocateDiesel, DEFAULT_STEAM, litersUsedBetween, meterHoursBetween, type SteamSettings, type SteamType } from "@/lib/steam";

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
export type SteamMachineRow = {
  id: number; branch_id: number; name: string; code: string; steam_type: SteamType; steam_kg_h: number | null;
  cycle_minutes: number | null; status: string; steam_count_by: "count" | "meter";
};
export type SteamTest = { id: number; equipment_id: number; branch_id: number; tested_on: string; minutes: number; condensate_kg: number; kg_h: number; notes: string | null };
const MACHINE_COLS = "id, branch_id, name, code, steam_type, steam_kg_h, cycle_minutes, status, steam_count_by";

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
const todayRiyadh = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

export async function loadSteamSettings(supabase: SupabaseClient): Promise<SteamSettings> {
  const { data } = await supabase.from("steam_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_STEAM;
  return Object.fromEntries(Object.keys(DEFAULT_STEAM).map((k) => [k, data[k] === undefined || data[k] === null ? DEFAULT_STEAM[k as keyof SteamSettings] : Number(data[k])])) as SteamSettings;
}

/**
 * Each branch's diesel for `month` (and the `history` months before it) shared between its
 * steam machines, with the checks that catch a machine or a boiler using too much:
 * expected vs actual diesel, the latest steam test of each machine, and hour meters.
 */
export async function loadSteam(supabase: SupabaseClient, branchIds: number[], month: string, history = 0) {
  const months = Array.from({ length: history + 1 }, (_, i) => shiftMonth(month, i - history));
  const first = monthRange(months[0]), last = monthRange(month);
  const lookBack = new Date(first.fromMs - 75 * 86400000);
  const lookBackDay = lookBack.toISOString().slice(0, 10);
  const [settings, { data: mach }, { data: counts }, { data: dips }, { data: refs }, { data: tests }] = await Promise.all([
    loadSteamSettings(supabase),
    supabase.from("equipment").select(MACHINE_COLS).in("branch_id", branchIds).not("steam_type", "is", null).order("steam_type").order("code"),
    supabase.from("steam_counts").select("equipment_id, branch_id, day, units, meter_reading").in("branch_id", branchIds).gte("day", lookBackDay).lt("day", last.to),
    supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, kind").in("branch_id", branchIds).gte("read_at", lookBack.toISOString()).lt("read_at", new Date(last.toMs).toISOString()),
    supabase.from("diesel_refuels").select("branch_id, refuel_date, liters, received_liters, total_amount, price_per_liter").in("branch_id", branchIds).lt("refuel_date", last.to).order("refuel_date", { ascending: false }),
    supabase.from("steam_tests").select("id, equipment_id, branch_id, tested_on, minutes, condensate_kg, kg_h, notes").in("branch_id", branchIds).order("tested_on", { ascending: false }).order("id", { ascending: false }),
  ]);
  const today = todayRiyadh();
  const allTests = (tests ?? []) as SteamTest[];

  function machineInfo(m: SteamMachineRow) {
    const catalog = m.steam_kg_h ? Number(m.steam_kg_h) : m.steam_type === "dryer" ? settings.dryer_kg_h : m.steam_type === "press" ? settings.press_kg_h : null;
    const mine = allTests.filter((x) => x.equipment_id === m.id);
    const test = mine[0] ?? null;
    const deviation = test && catalog ? ((Number(test.kg_h) - catalog) / catalog) * 100 : null;
    const ageDays = test ? Math.floor((Date.parse(today) - Date.parse(test.tested_on)) / 86400000) : null;
    return {
      catalog, test, tests: mine, deviation, high: deviation !== null && deviation > settings.test_alert_pct,
      due: ageDays === null || ageDays >= settings.test_every_days, ageDays,
      kgH: test ? Number(test.kg_h) : catalog,
    };
  }

  /** kg/h for a period: the latest steam test before its end, else the catalogue (a test does not rewrite earlier months). */
  function rateFor(m: SteamMachineRow, toExclusive: string) {
    const inf = machineInfo(m);
    const t = inf.tests.find((x) => x.tested_on < toExclusive);
    return t ? Number(t.kg_h) : inf.catalog;
  }

  function oneMonth(b: number, mo: string) {
    const { from, to, fromMs, toMs } = monthRange(mo);
    const machines = ((mach ?? []) as SteamMachineRow[]).filter((m) => m.branch_id === b);
    const info = new Map(machines.map((m) => [m.id, machineInfo(m)]));
    const all = (counts ?? []).filter((c) => c.branch_id === b);
    const mine = all.filter((c) => c.day >= from && c.day < to);
    const units = new Map<number, number>(), meter = new Map<number, number | null>();
    for (const c of mine) if (c.units !== null) units.set(c.equipment_id, (units.get(c.equipment_id) ?? 0) + Number(c.units));
    for (const m of machines) if (m.steam_count_by === "meter") meter.set(m.id, meterHoursBetween(all.filter((c) => c.equipment_id === m.id), from, to));
    const daysEntered = new Set(mine.map((c) => c.day)).size;
    const daysInMonth = new Date(Date.UTC(Number(mo.slice(0, 4)), Number(mo.slice(5)), 0)).getUTCDate();
    const daysSoFar = mo === today.slice(0, 7) ? Number(today.slice(8)) : mo > today.slice(0, 7) ? 0 : daysInMonth;

    const used = litersUsedBetween((dips ?? []).filter((d) => d.branch_id === b), fromMs, toMs);
    const bRefs = (refs ?? []).filter((r) => r.branch_id === b && r.refuel_date < to);
    const monthRefs = bRefs.filter((r) => r.refuel_date >= from);
    const delivered = monthRefs.reduce((s, r) => s + Number(r.received_liters ?? r.liters), 0);
    const source: "readings" | "deliveries" | "none" = used.readings > 0 ? "readings" : delivered > 0 ? "deliveries" : "none";
    const liters = source === "readings" ? used.liters : source === "deliveries" ? Math.round(delivered * 10) / 10 : 0;
    const priced = monthRefs.filter((r) => r.total_amount !== null);
    const pl = priced.reduce((s, r) => s + Number(r.liters), 0);
    const priceRaw = pl > 0 ? priced.reduce((s, r) => s + Number(r.total_amount), 0) / pl : (bRefs.find((r) => r.price_per_liter !== null)?.price_per_liter ?? null);
    const price = priceRaw === null ? null : Number(priceRaw);

    const result = allocateDiesel(machines.map((m) => ({
      id: m.id, type: m.steam_type, units: units.get(m.id) ?? 0, kgH: rateFor(m, to), cycleMin: m.cycle_minutes,
      meterHours: m.steam_count_by === "meter" ? (meter.get(m.id) ?? 0) : null,
    })), liters, price, settings);
    const byType = (t: SteamType) => {
      const rs = result.rows.filter((r) => r.type === t && r.units > 0);
      const u = rs.reduce((s, r) => s + r.units, 0);
      return u > 0 && price !== null ? rs.reduce((s, r) => s + (r.cost ?? 0), 0) / u : null;
    };
    const coverage = daysSoFar > 0 ? daysEntered / daysSoFar : 0;
    return {
      month: mo, machines, info, units, meter, daysEntered, daysSoFar, coverage, reliable: coverage >= 0.8 && source !== "none" && result.totalKg > 0,
      liters, source, price, result, settings, dryerUnitCost: byType("dryer"), pressUnitCost: byType("press"),
    };
  }

  const out = new Map<number, ReturnType<typeof oneMonth> & { trend: ReturnType<typeof oneMonth>[]; usual: number | null; jump: boolean }>();
  for (const b of branchIds) {
    const trend = months.map((mo) => oneMonth(b, mo));
    const cur = trend[trend.length - 1];
    const before = trend.slice(-4, -1).filter((x) => x.reliable && x.result.unexplainedPct !== null);
    const usual = before.length ? before.reduce((s, x) => s + (x.result.unexplainedPct ?? 0), 0) / before.length : null;
    const jump = usual !== null && cur.reliable && cur.result.unexplainedPct !== null && cur.result.unexplainedPct - usual > settings.unexplained_jump_pct;
    out.set(b, { ...cur, trend, usual, jump });
  }
  return out;
}
