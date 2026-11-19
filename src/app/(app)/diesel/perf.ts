import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bridge, operatingHours, per1000, usedBetween, type HoursRow, type MonthFigures } from "@/lib/dieselPerf";

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
const startMs = (m: string) => Date.parse(`${m}-01T00:00:00+03:00`);

export type Source = "readings" | "partial" | "import" | "manual" | "none";
export type BranchMonth = MonthFigures & {
  branchId: number; month: string; source: Source; estimated: boolean; price: number | null; hasTanks: boolean;
  valid: boolean; lp1000: number | null; cp1000: number | null; lph: number | null; blanketShare: number | null;
  index: number | null; regionIndex: number | null; shareGap: number | null; change: number | null;
  bridge: ReturnType<typeof bridge> | null; flags: string[];
};
export type Network = { liters: number; cost: number; pieces: number; price: number | null; lp1000: number | null; cp1000: number | null; branches: number };

/**
 * Diesel performance for `month` and the `history` months before it, for every
 * diesel branch: litres (from the tank readings, split between months by days,
 * or the month's own figures), cost, pieces, operating hours, and the comparisons.
 */
export async function loadPerformance(supabase: SupabaseClient, month: string, history = 5) {
  const months = Array.from({ length: history + 1 }, (_, i) => shiftMonth(month, i - history));
  const from = startMs(months[0]), to = startMs(shiftMonth(month, 1));
  const [{ data: branches }, { data: cities }, { data: bm }, { data: dips }, { data: refs }, { data: hours }, { data: stops }, { data: tanks }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en, city_id, status, power_source, sort").neq("status", "closed").order("city_id").order("sort"),
    supabase.from("cities").select("id, name_ar, name_en"),
    supabase.from("branch_months").select("*").gte("month", `${months[0]}-01`).lte("month", `${month}-01`),
    supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, kind").gte("read_at", new Date(from - 90 * 86400000).toISOString()).order("read_at"),
    supabase.from("diesel_refuels").select("branch_id, refuel_date, liters, total_amount, price_per_liter").lt("refuel_date", `${shiftMonth(month, 1)}-01`).order("refuel_date", { ascending: false }),
    supabase.from("branch_hours").select("branch_id, weekday, open_time, close_time, is_24h, is_closed"),
    supabase.from("branch_downtimes").select("branch_id, started_at, ended_at").lt("started_at", new Date(to).toISOString()),
    supabase.from("diesel_tanks").select("branch_id").eq("active", true),
  ]);
  const diesel = (branches ?? []).filter((b) => b.power_source !== "electric");
  const withTanks = new Set((tanks ?? []).map((x) => x.branch_id));

  const figures = (b: (typeof diesel)[number], mo: string) => {
    const f = startMs(mo), t = startMs(shiftMonth(mo, 1));
    const row = (bm ?? []).find((x) => x.branch_id === b.id && String(x.month).slice(0, 7) === mo);
    const mine = (dips ?? []).filter((d) => d.branch_id === b.id);
    const used = mine.length ? usedBetween(mine, f, t) : null;
    const own = row?.liters !== null && row?.liters !== undefined;
    const liters = own ? Number(row!.liters) : used && (used.liters > 0 || used.complete) ? used.liters : null;
    const source: Source = own ? (row!.source === "import" ? "import" : "manual") : used ? (used.complete ? "readings" : "partial") : "none";
    const bRefs = (refs ?? []).filter((r) => r.branch_id === b.id && r.refuel_date < `${shiftMonth(mo, 1)}-01`);
    const inMonth = bRefs.filter((r) => r.refuel_date >= `${mo}-01` && r.total_amount !== null);
    const pl = inMonth.reduce((s, r) => s + Number(r.liters), 0);
    const invoicePrice = pl > 0 ? inMonth.reduce((s, r) => s + Number(r.total_amount), 0) / pl : bRefs.find((r) => r.price_per_liter !== null)?.price_per_liter ?? null;
    const cost = row?.cost !== null && row?.cost !== undefined ? Number(row.cost) : liters !== null && invoicePrice !== null ? liters * Number(invoicePrice) : null;
    const price = liters && cost !== null ? cost / liters : invoicePrice === null ? null : Number(invoicePrice);
    const hrs = operatingHours((hours ?? []).filter((h) => h.branch_id === b.id) as HoursRow[], mo, (stops ?? []).filter((s) => s.branch_id === b.id));
    const pieces = row?.pieces ?? null, blankets = row?.blankets ?? null;
    const valid = liters !== null && source !== "partial" && !!pieces;
    return {
      branchId: b.id, month: mo, liters, cost, pieces, blankets, hours: hrs, source, estimated: !!row?.estimated, price, hasTanks: withTanks.has(b.id), valid,
      lp1000: valid ? per1000(liters, pieces) : null, cp1000: valid ? per1000(cost, pieces) : null,
      lph: liters !== null && source !== "partial" && hrs ? liters / hrs : null,
      blanketShare: pieces && blankets !== null ? (blankets / pieces) * 100 : null,
      index: null, regionIndex: null, shareGap: null, change: null, bridge: null, flags: [],
    } as BranchMonth;
  };

  const grid = new Map<string, BranchMonth>(); // `${branch}|${month}`
  for (const b of diesel) for (const mo of months) grid.set(`${b.id}|${mo}`, figures(b, mo));

  const avg = (rows: BranchMonth[]): Network => {
    const ok = rows.filter((r) => r.valid && !r.estimated);
    const liters = ok.reduce((s, r) => s + r.liters!, 0), cost = ok.reduce((s, r) => s + (r.cost ?? 0), 0), pieces = ok.reduce((s, r) => s + r.pieces!, 0);
    return { liters, cost, pieces, price: liters ? cost / liters : null, lp1000: per1000(liters, pieces), cp1000: per1000(cost, pieces), branches: ok.length };
  };
  const network = new Map<string, Network>(), region = new Map<string, Network>();
  for (const mo of months) {
    const rows = diesel.map((b) => grid.get(`${b.id}|${mo}`)!);
    const net = avg(rows);
    network.set(mo, net);
    for (const c of cities ?? []) region.set(`${c.id}|${mo}`, avg(diesel.filter((b) => b.city_id === c.id).map((b) => grid.get(`${b.id}|${mo}`)!)));
    for (const b of diesel) {
      const r = grid.get(`${b.id}|${mo}`)!, reg = region.get(`${b.city_id}|${mo}`)!;
      if (r.lp1000 !== null) {
        r.index = net.lp1000 ? (r.lp1000 / net.lp1000) * 100 : null;
        r.regionIndex = reg.lp1000 && reg.branches > 1 ? (r.lp1000 / reg.lp1000) * 100 : null;
        r.shareGap = r.valid && !r.estimated && net.liters && net.pieces ? ((r.liters! / net.liters) - (r.pieces! / net.pieces)) * 100 : null;
      }
      const prev = grid.get(`${b.id}|${shiftMonth(mo, -1)}`);
      if (prev && prev.valid && r.valid) {
        r.change = prev.lp1000 ? ((r.lp1000! / prev.lp1000) - 1) * 100 : null;
        r.bridge = bridge(r, prev);
      }
      // what needs a look
      if (r.valid && !r.estimated) {
        if (r.index !== null && r.index > 120) r.flags.push("high");
        const p2 = grid.get(`${b.id}|${shiftMonth(mo, -2)}`);
        if (prev?.valid && p2?.valid && r.lp1000! > prev.lp1000! && prev.lp1000! > p2.lp1000!) r.flags.push("rising");
        if (r.price !== null && reg.price && Math.abs(r.price / reg.price - 1) > 0.05) r.flags.push("price");
      }
      if (!r.pieces) r.flags.push("noPieces");
      if (r.source === "partial") r.flags.push("partial");
      if (r.source === "none") r.flags.push("noLiters");
    }
  }
  // the network's change = the branches' changes added up (branches with figures in both months)
  const netBridge = (mo: string) => {
    const rs = diesel.map((b) => grid.get(`${b.id}|${mo}`)!).filter((r) => r.bridge?.liters && r.bridge.cost && !r.estimated);
    if (!rs.length) return null;
    const sum = (f: (r: BranchMonth) => number) => rs.reduce((s, r) => s + f(r), 0);
    return {
      branches: rs.length,
      liters: { change: sum((r) => r.bridge!.liters!.change), volume: sum((r) => r.bridge!.liters!.volume), efficiency: sum((r) => r.bridge!.liters!.efficiency) },
      cost: { change: sum((r) => r.bridge!.cost!.change), price: sum((r) => r.bridge!.cost!.price), quantity: sum((r) => r.bridge!.cost!.quantity) },
    };
  };
  return { months, branches: diesel, cities: cities ?? [], grid, network, region, netBridge, at: (b: number, mo: string) => grid.get(`${b}|${mo}`)! };
}

/** The latest month (not after now) that has pieces entered, else last month. */
export async function defaultMonth(supabase: SupabaseClient) {
  const now = monthOf(null);
  const { data } = await supabase.from("branch_months").select("month").not("pieces", "is", null).lte("month", `${now}-01`).order("month", { ascending: false }).limit(1);
  return data?.[0] ? String(data[0].month).slice(0, 7) : shiftMonth(now, -1);
}
