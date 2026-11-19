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
export type Hours = { scheduled: number; perDay: number; stopped: number; actual: number; days: number };
export type BranchMonth = MonthFigures & {
  branchId: number; month: string; source: Source; estimated: boolean; price: number | null; hasTanks: boolean; valid: boolean;
  orders: number | null; hours: Hours | null; capacity: number | null; dryers: number | null; presses: number | null;
  lp1000: number | null; cp1000: number | null; lp100orders: number | null; costPerOrder: number | null; piecesPerOrder: number | null;
  lph: number | null; cph: number | null; blanketShare: number | null; turnover: number | null; coverDays: number | null;
  index: number | null; regionIndex: number | null; shareGap: number | null; priceVsRegion: number | null;
  change: number | null; litersChange: number | null; costChange: number | null; piecesChange: number | null;
  bridge: ReturnType<typeof bridge> | null; flags: string[];
};
export type Network = {
  liters: number; cost: number; pieces: number; orders: number; hours: number; price: number | null;
  lp1000: number | null; cp1000: number | null; lp100orders: number | null; costPerOrder: number | null; lph: number | null; branches: number;
};
const pctChange = (a: number | null | undefined, b: number | null | undefined) => (a !== null && a !== undefined && b ? ((a / b) - 1) * 100 : null);

/**
 * Diesel performance for `month` and the `history` months before it, for every
 * diesel branch: litres (from the tank readings, split between months by days,
 * or the month's own figures), cost, pieces, orders, hours, tanks, and the comparisons.
 */
export async function loadPerformance(supabase: SupabaseClient, month: string, history = 5) {
  const months = Array.from({ length: history + 1 }, (_, i) => shiftMonth(month, i - history));
  const from = startMs(months[0]), to = startMs(shiftMonth(month, 1));
  const [{ data: branches }, { data: cities }, { data: bm }, { data: dips }, { data: refs }, { data: hours }, { data: stops }, { data: tanks }, { data: equip }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en, city_id, status, power_source, sort").neq("status", "closed").order("city_id").order("sort"),
    supabase.from("cities").select("id, name_ar, name_en"),
    supabase.from("branch_months").select("*").gte("month", `${shiftMonth(months[0], -2)}-01`).lte("month", `${month}-01`),
    supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, kind").gte("read_at", new Date(from - 150 * 86400000).toISOString()).order("read_at"),
    supabase.from("diesel_refuels").select("branch_id, refuel_date, liters, total_amount, price_per_liter").lt("refuel_date", `${shiftMonth(month, 1)}-01`).order("refuel_date", { ascending: false }),
    supabase.from("branch_hours").select("branch_id, weekday, open_time, close_time, is_24h, is_closed"),
    supabase.from("branch_downtimes").select("branch_id, started_at, ended_at").lt("started_at", new Date(to).toISOString()),
    supabase.from("v_diesel_tank_info").select("branch_id, capacity_l").eq("active", true),
    supabase.from("equipment").select("branch_id, quantity, status, ticket_categories(code)").neq("status", "retired"),
  ]);
  const diesel = (branches ?? []).filter((b) => b.power_source !== "electric");
  const capacity = new Map<number, number>();
  for (const x of tanks ?? []) capacity.set(x.branch_id, (capacity.get(x.branch_id) ?? 0) + Number(x.capacity_l ?? 0));
  const count = (b: number, code: string) => {
    const list = (equip ?? []).filter((e) => e.branch_id === b && (e.ticket_categories as unknown as { code: string } | null)?.code === code);
    return list.length ? list.reduce((s, e) => s + Number(e.quantity ?? 1), 0) : null;
  };

  const figures = (b: (typeof diesel)[number], mo: string): BranchMonth => {
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
    const pieces = row?.pieces ?? null, blankets = row?.blankets ?? null, orders = row?.orders ?? null;
    const full = liters !== null && source !== "partial";
    const valid = full && !!pieces;
    const cap = capacity.get(b.id) ?? null;
    const days = hrs?.days ?? new Date(Date.UTC(Number(mo.slice(0, 4)), Number(mo.slice(5)), 0)).getUTCDate();
    return {
      branchId: b.id, month: mo, liters, cost, pieces, blankets, orders, hours: hrs, source, estimated: !!row?.estimated, price, hasTanks: capacity.has(b.id), valid,
      capacity: cap, dryers: count(b.id, "DR"), presses: count(b.id, "PM"),
      lp1000: valid ? per1000(liters, pieces) : null, cp1000: valid ? per1000(cost, pieces) : null,
      lp100orders: full && orders ? (liters! / orders) * 100 : null, costPerOrder: full && orders && cost !== null ? cost / orders : null,
      piecesPerOrder: pieces && orders ? pieces / orders : null,
      lph: full && hrs?.actual ? liters! / hrs.actual : null, cph: full && hrs?.actual && cost !== null ? cost / hrs.actual : null,
      blanketShare: pieces && blankets !== null ? (blankets / pieces) * 100 : null,
      turnover: full && cap ? liters! / cap : null, coverDays: full && cap && liters ? cap / (liters / days) : null,
      index: null, regionIndex: null, shareGap: null, priceVsRegion: null, change: null, litersChange: null, costChange: null, piecesChange: null, bridge: null, flags: [],
    };
  };

  const grid = new Map<string, BranchMonth>(); // `${branch}|${month}`
  const allMonths = [shiftMonth(months[0], -2), shiftMonth(months[0], -1), ...months]; // two before, for "rising two months in a row"
  for (const b of diesel) for (const mo of allMonths) grid.set(`${b.id}|${mo}`, figures(b, mo));

  const avg = (rows: BranchMonth[]): Network => {
    const ok = rows.filter((r) => r.valid && !r.estimated);
    const sum = (f: (r: BranchMonth) => number | null | undefined) => ok.reduce((s, r) => s + Number(f(r) ?? 0), 0);
    const liters = sum((r) => r.liters), cost = sum((r) => r.cost), pieces = sum((r) => r.pieces);
    const withOrders = ok.filter((r) => r.orders), withHours = ok.filter((r) => r.hours?.actual);
    const oL = withOrders.reduce((s, r) => s + r.liters!, 0), oC = withOrders.reduce((s, r) => s + (r.cost ?? 0), 0), orders = withOrders.reduce((s, r) => s + r.orders!, 0);
    const hL = withHours.reduce((s, r) => s + r.liters!, 0), hrs = withHours.reduce((s, r) => s + r.hours!.actual, 0);
    return {
      liters, cost, pieces, orders, hours: hrs, price: liters ? cost / liters : null, lp1000: per1000(liters, pieces), cp1000: per1000(cost, pieces),
      lp100orders: orders ? (oL / orders) * 100 : null, costPerOrder: orders ? oC / orders : null, lph: hrs ? hL / hrs : null, branches: ok.length,
    };
  };
  const network = new Map<string, Network>(), region = new Map<string, Network>();
  for (const mo of allMonths) {
    const rows = diesel.map((b) => grid.get(`${b.id}|${mo}`)!);
    const net = avg(rows);
    network.set(mo, net);
    for (const c of cities ?? []) region.set(`${c.id}|${mo}`, avg(diesel.filter((b) => b.city_id === c.id).map((b) => grid.get(`${b.id}|${mo}`)!)));
    for (const b of diesel) {
      const r = grid.get(`${b.id}|${mo}`)!, reg = region.get(`${b.city_id}|${mo}`)!;
      if (r.lp1000 !== null) {
        r.index = net.lp1000 ? (r.lp1000 / net.lp1000) * 100 : null;
        r.regionIndex = reg.lp1000 && reg.branches > 1 ? (r.lp1000 / reg.lp1000) * 100 : null;
        r.shareGap = !r.estimated && net.liters && net.pieces ? ((r.liters! / net.liters) - (r.pieces! / net.pieces)) * 100 : null;
      }
      r.priceVsRegion = r.price !== null && reg.price ? pctChange(r.price, reg.price) : null;
      const prev = grid.get(`${b.id}|${shiftMonth(mo, -1)}`);
      if (prev) {
        r.litersChange = r.source !== "partial" ? pctChange(r.liters, prev.liters) : null;
        r.costChange = r.source !== "partial" ? pctChange(r.cost, prev.cost) : null;
        r.piecesChange = pctChange(r.pieces, prev.pieces);
      }
      if (prev && prev.valid && r.valid) {
        r.change = pctChange(r.lp1000, prev.lp1000);
        r.bridge = bridge(r, prev);
      }
      // what needs a look
      if (r.valid && !r.estimated) {
        if (r.index !== null && r.index > 120) r.flags.push("high");
        const p2 = grid.get(`${b.id}|${shiftMonth(mo, -2)}`);
        if (prev?.valid && p2?.valid && r.lp1000! > prev.lp1000! && prev.lp1000! > p2.lp1000!) r.flags.push("rising");
        if (r.priceVsRegion !== null && Math.abs(r.priceVsRegion) > 5) r.flags.push("price");
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
