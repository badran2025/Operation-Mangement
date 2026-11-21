import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { branchDiesel, type Dip, type RefuelLite, type Tank } from "@/lib/diesel";
import { defaultMonth, loadPerformance } from "./perf";

/**
 * The diesel state of each open diesel branch the viewer can see, for the other
 * tabs (home page, branch page): tank stock (or "needs a reading"), when the next
 * delivery is due, the last delivery, and the last month's litres per 1,000 pieces and status.
 */
export async function dieselSummary(supabase: SupabaseClient, only?: number) {
  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const [{ data: branches }, { data: tankData }, { data: dipData }, { data: refData }, month] = await Promise.all([
    only ? supabase.from("branches").select("id, power_source, status").eq("id", only) : supabase.from("branches").select("id, power_source, status"),
    only ? supabase.from("v_diesel_tank_info").select("*").eq("active", true).eq("branch_id", only) : supabase.from("v_diesel_tank_info").select("*").eq("active", true),
    only ? supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, level_cm, kind").gte("read_at", since).eq("branch_id", only)
      : supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, level_cm, kind").gte("read_at", since),
    only ? supabase.from("diesel_refuels").select("id, branch_id, refuel_date, liters, before_liters").eq("branch_id", only).order("refuel_date", { ascending: false }).limit(50)
      : supabase.from("diesel_refuels").select("id, branch_id, refuel_date, liters, before_liters").order("refuel_date", { ascending: false }).limit(600),
    defaultMonth(supabase),
  ]);
  const perf = await loadPerformance(supabase, month, 0);
  const now = Date.now();
  const tanks = (tankData ?? []) as Tank[], dips = (dipData ?? []) as Dip[], refs = (refData ?? []) as (RefuelLite & { branch_id: number })[];
  const rows = (branches ?? []).filter((b) => b.power_source !== "electric" && b.status !== "closed").map((b) => {
    const mine = tanks.filter((x) => x.branch_id === b.id);
    const st = branchDiesel(mine, dips.filter((d) => d.branch_id === b.id), refs.filter((r) => r.branch_id === b.id), b.id, now);
    const m = perf.has(b.id, month) ? perf.at(b.id, month) : null;
    const nextIn = st.next !== null ? Math.round((st.next - now) / 86400000) : null;
    return { id: b.id, hasTanks: mine.length > 0, st, nextIn, lp1000: m?.lp1000 ?? null, status: m && !m.estimated ? m.status : "none" as const };
  });
  return { month, rows, net: perf.network.get(month)?.lp1000 ?? null };
}
