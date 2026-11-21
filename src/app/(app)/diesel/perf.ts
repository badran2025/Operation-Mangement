import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hoursBetween, per1000, segmentsOf, burntIn, type HoursRow, type ReadingLite } from "@/lib/dieselPerf";

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
const DAY = 86400000;

/**
 * Where a month's litres come from:
 * manual / import = written in the monthly figures; readings = the tank readings cover the whole month;
 * partial = the readings cover part of it (still being worked out); none = nothing yet.
 */
export type Source = "readings" | "partial" | "import" | "manual" | "none";
export type Status = "risk" | "watch" | "good" | "normal" | "none";
export type BranchMonth = {
  branchId: number; month: string; source: Source; estimated: boolean;
  liters: number | null; cost: number | null; price: number | null; pieces: number | null; blankets: number | null;
  /** the days the litres are known for, and the hours worked on those days */
  days: number | null; hours: number | null; lph: number | null;
  /** deliveries made this month: litres in the tanks, what they cost, how many, how many with no price */
  delivered: number | null; deliveredCost: number | null; deliveries: number; unpriced: number;
  /** complete litres and pieces: counts in totals and comparisons */
  valid: boolean; lp1000: number | null; blanketShare: number | null;
  index: number | null; priceVsRegion: number | null; change: number | null; status: Status;
  savingL: number | null; savingSAR: number | null; hasTanks: boolean;
};
export type Network = { liters: number; cost: number; pieces: number; price: number | null; lp1000: number | null; branches: number };
export type PerfBranch = { id: number; name_ar: string; name_en: string; city_id: number; status: string; power_source: string; sort: number; closed: boolean };
const pctChange = (a: number | null | undefined, b: number | null | undefined) => (a !== null && a !== undefined && b ? ((a / b) - 1) * 100 : null);

type Raw = {
  branches: Omit<PerfBranch, "closed">[]; cities: { id: number; name_ar: string; name_en: string }[];
  months: { branch_id: number; month: string; pieces: number | null; blankets: number | null; liters: number | null; cost: number | null; estimated: boolean; source: string | null }[];
  dips: (ReadingLite & { branch_id: number; refuel_id: number | null })[];
  refuels: { id: number; branch_id: number; refuel_date: string; liters: number; received_liters: number | null; total_amount: number | null; supplier: string | null; supplier_id: number | null }[];
  hours: (HoursRow & { branch_id: number })[]; stops: { branch_id: number; started_at: string; ended_at: string | null }[];
  suppliers: { id: number; name: string; price_per_liter: number | null }[];
};

/**
 * Diesel performance for `month` and the `history` months before it, for every
 * diesel branch of the network (whoever looks: the comparison is always against
 * the whole network). Litres come from the tank readings, split between months
 * by days and priced at the delivery they came from, unless written by hand.
 */
export async function loadPerformance(supabase: SupabaseClient, month: string, history = 5) {
  const months = Array.from({ length: history + 1 }, (_, i) => shiftMonth(month, i - history));
  const allMonths = [shiftMonth(months[0], -1), ...months]; // one before, for the change
  const { data, error } = await supabase.rpc("diesel_perf_data", { p_from: `${allMonths[0]}-01`, p_to: `${month}-01` });
  if (error) throw new Error(error.message);
  const raw = data as Raw;
  const now = Date.now();

  // a delivery's cost: its invoice total, or its litres at its supplier's fixed price
  const supPrice = new Map<string, number>();
  for (const x of raw.suppliers) if (x.price_per_liter !== null) { supPrice.set(`id:${x.id}`, Number(x.price_per_liter)); supPrice.set(`name:${String(x.name).trim()}`, Number(x.price_per_liter)); }
  const totalOf = (r: Raw["refuels"][number]) => {
    if (r.total_amount !== null) return Number(r.total_amount);
    const p = (r.supplier_id ? supPrice.get(`id:${r.supplier_id}`) : undefined) ?? (r.supplier ? supPrice.get(`name:${r.supplier.trim()}`) : undefined);
    return p ? Number(r.liters) * p : null;
  };
  const priced = raw.refuels.map((r) => ({ ...r, total: totalOf(r) })).sort((a, b) => a.refuel_date.localeCompare(b.refuel_date) || a.id - b.id);

  // a branch that closed stays in the months it worked; it only leaves the current lists
  const hasData = new Set([...raw.months.filter((m) => m.liters !== null || m.pieces !== null).map((m) => m.branch_id), ...raw.dips.map((d) => d.branch_id)]);
  const diesel: PerfBranch[] = raw.branches.filter((b) => b.power_source !== "electric" && (b.status !== "closed" || hasData.has(b.id))).map((b) => ({ ...b, closed: b.status === "closed" }));
  const tanksOf = new Set(raw.dips.map((d) => d.branch_id));

  const figures = new Map<string, BranchMonth>();
  for (const b of diesel) {
    const refs = priced.filter((r) => r.branch_id === b.id);
    // the price of the fuel in the tank at a moment: the last priced delivery made by then (else the first one after)
    const priceAt = (ms: number) => {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date(ms));
      const before = refs.filter((r) => r.total !== null && r.refuel_date <= day).at(-1) ?? refs.find((r) => r.total !== null);
      return before ? before.total! / Number(before.liters) : null;
    };
    const { segs, start, end } = segmentsOf(raw.dips.filter((d) => d.branch_id === b.id), priceAt);
    const hours = raw.hours.filter((h) => h.branch_id === b.id), stops = raw.stops.filter((s) => s.branch_id === b.id);

    const one = (mo: string): BranchMonth => {
      const f = startMs(mo), t = Math.min(startMs(shiftMonth(mo, 1)), now);
      const row = raw.months.find((x) => x.branch_id === b.id && String(x.month).slice(0, 7) === mo);
      const monthRefs = refs.filter((r) => r.refuel_date.slice(0, 7) === mo);
      const withPrice = monthRefs.filter((r) => r.total !== null);
      const delivered = monthRefs.length ? Math.round(monthRefs.reduce((s, r) => s + Number(r.received_liters ?? r.liters), 0) * 10) / 10 : null;
      const deliveredCost = withPrice.length ? Math.round(withPrice.reduce((s, r) => s + r.total!, 0) * 100) / 100 : null;

      // the part of the month the readings reach
      const a = start === null ? null : Math.max(f, start), z = end === null ? null : Math.min(t, end);
      const known = a !== null && z !== null && z > a;
      const use = known ? burntIn(segs, a!, z!) : null;
      const full = known && a === f && z === t && startMs(shiftMonth(mo, 1)) <= now;
      const own = row?.liters !== null && row?.liters !== undefined;
      const source: Source = own ? (row!.source === "import" ? "import" : "manual") : full ? "readings" : known ? "partial" : "none";
      const liters = own ? Number(row!.liters) : use ? use.liters : null;
      // cost: written by hand, else each litre at the price of the delivery it came from
      const fallbackPrice = use && use.liters - use.unpricedL > 0 ? use.cost / (use.liters - use.unpricedL) : priceAt(Math.min(t, now));
      const cost = own ? (row!.cost !== null ? Number(row!.cost) : fallbackPrice !== null ? liters! * fallbackPrice : null)
        : use && liters ? (use.unpricedL === 0 ? use.cost : fallbackPrice !== null ? use.cost + use.unpricedL * fallbackPrice : null) : null;
      // hours on the same days as the litres
      const span = own ? [f, t] as const : known ? [a!, z!] as const : null;
      const hrs = span ? hoursBetween(hours, span[0], span[1], stops, now)?.actual ?? null : null;
      const pieces = row?.pieces ?? null, blankets = row?.blankets ?? null;
      const complete = own || full;
      const valid = complete && liters !== null && !!pieces;
      return {
        branchId: b.id, month: mo, source, estimated: !!row?.estimated,
        liters, cost, price: liters && cost !== null ? cost / liters : null, pieces, blankets,
        days: span ? (span[1] - span[0]) / DAY : null, hours: hrs, lph: liters && hrs ? liters / hrs : null,
        delivered, deliveredCost, deliveries: monthRefs.length, unpriced: monthRefs.length - withPrice.length,
        valid, lp1000: valid ? per1000(liters, pieces) : null, blanketShare: pieces && blankets !== null ? (blankets / pieces) * 100 : null,
        index: null, priceVsRegion: null, change: null, status: "none", savingL: null, savingSAR: null, hasTanks: tanksOf.has(b.id),
      };
    };
    for (const mo of allMonths) figures.set(`${b.id}|${mo}`, one(mo));
  }

  // the network and each city, month by month: complete months only, estimates left out
  const avg = (rows: BranchMonth[]): Network => {
    const ok = rows.filter((r) => r.valid && !r.estimated);
    const liters = ok.reduce((s, r) => s + r.liters!, 0), pieces = ok.reduce((s, r) => s + r.pieces!, 0);
    const pricedRows = ok.filter((r) => r.cost !== null), pl = pricedRows.reduce((s, r) => s + r.liters!, 0), cost = pricedRows.reduce((s, r) => s + r.cost!, 0);
    return { liters, cost, pieces, price: pl ? cost / pl : null, lp1000: per1000(liters, pieces), branches: ok.length };
  };
  const network = new Map<string, Network>(), region = new Map<string, Network>();
  for (const mo of allMonths) {
    const rows = diesel.map((b) => figures.get(`${b.id}|${mo}`)!);
    const net = avg(rows);
    network.set(mo, net);
    for (const c of raw.cities) region.set(`${c.id}|${mo}`, avg(diesel.filter((b) => b.city_id === c.id).map((b) => figures.get(`${b.id}|${mo}`)!)));
    for (const b of diesel) compare(figures.get(`${b.id}|${mo}`)!, net, region.get(`${b.city_id}|${mo}`)!, figures.get(`${b.id}|${shiftMonth(mo, -1)}`));
  }
  function compare(r: BranchMonth, net: Network, reg: Network, prev: BranchMonth | undefined) {
    {
      r.index = r.lp1000 !== null && net.lp1000 ? (r.lp1000 / net.lp1000) * 100 : null;
      r.priceVsRegion = r.price !== null && reg.price ? pctChange(r.price, reg.price) : null;
      if (prev?.valid && r.valid) r.change = pctChange(r.lp1000, prev.lp1000);
      if (r.valid && !r.estimated) {
        const worse = r.change !== null && r.change > 5;
        r.status = (r.index ?? 0) > 150 || ((r.index ?? 0) > 120 && worse) ? "risk"
          : (r.index ?? 0) > 120 || worse || (r.priceVsRegion ?? 0) > 5 ? "watch" : (r.index ?? 100) < 80 ? "good" : "normal";
        if (net.lp1000) {
          r.savingL = Math.max(r.liters! - (r.pieces! * net.lp1000) / 1000, 0);
          r.savingSAR = r.price !== null ? r.savingL * r.price : null;
        }
      }
    }
  }
  const names = new Map(raw.branches.map((b) => [b.id, b]));
  return { months, branches: diesel, names, cities: raw.cities, network, region, at: (b: number, mo: string) => figures.get(`${b}|${mo}`)!, has: (b: number, mo: string) => figures.has(`${b}|${mo}`) };
}
export type Perf = Awaited<ReturnType<typeof loadPerformance>>;

/** The latest month (not after now) that has pieces entered, else last month. */
export async function defaultMonth(supabase: SupabaseClient) {
  const now = monthOf(null);
  const { data } = await supabase.from("branch_months").select("month").not("pieces", "is", null).lte("month", `${now}-01`).order("month", { ascending: false }).limit(1);
  return data?.[0] ? String(data[0].month).slice(0, 7) : shiftMonth(now, -1);
}
