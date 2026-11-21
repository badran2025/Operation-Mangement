import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { per1000 } from "@/lib/dieselPerf";
import { monthOf, shiftMonth, type Perf, type Status } from "./perf";

export type PeriodKind = "1" | "3" | "6" | "all" | "range";
export type Period = { kind: PeriodKind; from: string; to: string; months: string[]; prev: string[] };
const valid = (m?: string) => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const span = (from: string, to: string) => { const out: string[] = []; for (let m = from; m <= to && out.length < 60; m = shiftMonth(m, 1)) out.push(m); return out; };

/** The first month that has any diesel figure (monthly figures or a delivery). */
export async function earliestMonth(supabase: SupabaseClient) {
  const [{ data: a }, { data: b }] = await Promise.all([
    supabase.from("branch_months").select("month").order("month").limit(1),
    supabase.from("diesel_refuels").select("refuel_date").order("refuel_date").limit(1),
  ]);
  const xs = [a?.[0]?.month, b?.[0]?.refuel_date].filter(Boolean).map((v) => String(v).slice(0, 7)).sort();
  return xs[0] ?? monthOf(null);
}

/** Period from the address: p = 1 | 3 | 6 | all | range, m = the last month, from / to for a range. */
export function parsePeriod(sp: { p?: string; m?: string; from?: string; to?: string }, fallback: string, earliest: string): Period {
  const now = monthOf(null);
  const kind: PeriodKind = (["1", "3", "6", "all", "range"] as const).find((k) => k === sp.p) ?? (sp.m ? "1" : "all"); // opening the page: all months
  let from: string, to: string;
  if (kind === "all") { from = earliest; to = now; }
  else if (kind === "range") {
    from = valid(sp.from) ? sp.from! : earliest; to = valid(sp.to) ? sp.to! : now;
    if (from > to) [from, to] = [to, from];
    if (to > now) to = now;
  } else {
    to = valid(sp.m) ? sp.m! : fallback;
    if (to > now) to = now;
    from = shiftMonth(to, -(Number(kind) - 1));
  }
  const months = span(from, to);
  return { kind, from, to, months, prev: months.map((m) => shiftMonth(m, -months.length)) };
}

/** The address part that keeps the period when moving between pages. */
export const periodToQuery = (p: Period) => (p.kind === "all" ? "p=all" : p.kind === "range" ? `p=range&from=${p.from}&to=${p.to}` : `p=${p.kind}&m=${p.to}`);

export type Agg = {
  branchId: number; liters: number | null; cost: number | null; price: number | null; pieces: number | null; blanketShare: number | null;
  lp1000: number | null; lph: number | null; hours: number | null; index: number | null; change: number | null;
  status: Status; savingL: number | null; savingSAR: number | null; priceVsRegion: number | null;
  deliveries: number; delivered: number | null; deliveredCost: number | null; unpriced: number; estimated: boolean; valid: boolean;
  peers: number[]; peerLp: number | null; validLiters: number; validPieces: number;
  /** months of the period left out of the totals, and why */
  left: { month: string; why: "noPieces" | "partial" | "noLiters" | "estimated" }[];
};
export type NetAgg = { liters: number; cost: number; pieces: number; lp1000: number | null; lph: number | null; price: number | null; branches: number; deliveries: number };

/**
 * One branch added up over a set of months. Only complete months count in the
 * totals (litres and pieces both known, not an estimate), so litres ÷ pieces
 * always gives the litres per 1,000 pieces shown. Deliveries count every month.
 */
function sumBranch(perf: Perf, id: number, months: string[]) {
  let vL = 0, vC = 0, cL = 0, vP = 0, bl = 0, blP = 0, hrs = 0, hL = 0, est = 0, deliveries = 0, delivered = 0, dCost = 0, unpriced = 0, hasDel = false, hasDCost = false;
  const left: Agg["left"] = [];
  for (const m of months) {
    if (!perf.has(id, m)) continue;
    const x = perf.at(id, m);
    deliveries += x.deliveries; unpriced += x.unpriced;
    if (x.delivered !== null) { delivered += x.delivered; hasDel = true; }
    if (x.deliveredCost !== null) { dCost += x.deliveredCost; hasDCost = true; }
    if (x.valid && !x.estimated) {
      vL += x.liters!; vP += x.pieces!;
      if (x.cost !== null) { vC += x.cost; cL += x.liters!; }
      if (x.blankets !== null) { bl += x.blankets; blP += x.pieces!; }
      if (x.hours) { hrs += x.hours; hL += x.liters!; }
    } else if (x.liters !== null || x.pieces || x.deliveries) {
      if (x.estimated) est++;
      left.push({ month: m, why: x.estimated ? "estimated" : x.source === "partial" ? "partial" : x.liters === null ? "noLiters" : "noPieces" });
    }
  }
  return { vL, vC, cL, vP, bl, blP, hrs, hL, estimated: est > 0 && vL === 0, deliveries, delivered: hasDel ? delivered : null, deliveredCost: hasDCost ? dCost : null, unpriced, left };
}

/** Every diesel branch over the period, compared with the network, its city, similar branches and the period before. */
export function aggregate(perf: Perf, period: Period) {
  const base = (months: string[]) => new Map(perf.branches.map((b) => [b.id, sumBranch(perf, b.id, months)]));
  const cur = base(period.months), before = base(period.prev);
  const netOf = (m: Map<number, ReturnType<typeof sumBranch>>, ids: number[]): NetAgg => {
    const xs = ids.map((id) => m.get(id)!).filter(Boolean);
    const sum = (f: (x: ReturnType<typeof sumBranch>) => number) => xs.reduce((s, x) => s + f(x), 0);
    const liters = sum((x) => x.vL), pieces = sum((x) => x.vP), cost = sum((x) => x.vC), cL = sum((x) => x.cL), hrs = sum((x) => x.hrs);
    return { liters, cost, pieces, lp1000: per1000(liters, pieces), lph: hrs ? sum((x) => x.hL) / hrs : null, price: cL ? cost / cL : null, branches: xs.filter((x) => x.vP > 0).length, deliveries: sum((x) => x.deliveries) };
  };
  const ids = perf.branches.map((b) => b.id);
  const net = netOf(cur, ids), prevNet = netOf(before, ids);
  const cityOf = new Map(perf.branches.map((b) => [b.id, b.city_id]));
  const region = new Map<number, NetAgg>();
  for (const c of new Set(perf.branches.map((b) => b.city_id))) region.set(c, netOf(cur, ids.filter((id) => cityOf.get(id) === c)));

  const rows = new Map<number, Agg>();
  for (const id of ids) {
    const x = cur.get(id)!, p = before.get(id)!;
    const lp = per1000(x.vL, x.vP), lpPrev = per1000(p.vL, p.vP);
    const price = x.cL ? x.vC / x.cL : null;
    const reg = region.get(cityOf.get(id)!)!;
    const index = lp !== null && net.lp1000 ? (lp / net.lp1000) * 100 : null;
    const change = lp !== null && lpPrev ? ((lp / lpPrev) - 1) * 100 : null;
    const savingL = lp !== null && net.lp1000 ? Math.max(x.vL - (x.vP * net.lp1000) / 1000, 0) : null;
    const worse = change !== null && change > 5;
    const priceVsRegion = price !== null && reg.price ? ((price / reg.price) - 1) * 100 : null;
    const status: Status = lp === null ? "none" : (index ?? 0) > 150 || ((index ?? 0) > 120 && worse) ? "risk"
      : (index ?? 0) > 120 || worse || (priceVsRegion !== null && priceVsRegion > 5) ? "watch" : (index ?? 100) < 80 ? "good" : "normal";
    rows.set(id, {
      branchId: id, liters: x.vL || null, cost: x.cL ? x.vC : null, price, pieces: x.vP || null, blanketShare: x.blP ? (x.bl / x.blP) * 100 : null,
      lp1000: lp, lph: x.hrs ? x.hL / x.hrs : null, hours: x.hrs || null, index, change, status,
      savingL, savingSAR: savingL !== null && price !== null ? savingL * price : null, priceVsRegion,
      deliveries: x.deliveries, delivered: x.delivered, deliveredCost: x.deliveredCost, unpriced: x.unpriced, estimated: x.estimated, valid: lp !== null,
      peers: [], peerLp: null, validLiters: x.vL, validPieces: x.vP, left: x.left,
    });
  }
  // similar branches: pieces within 25% over the same period
  for (const r of rows.values()) {
    if (!r.valid) continue;
    const ps = [...rows.values()].filter((o) => o.branchId !== r.branchId && o.valid && Math.abs(o.validPieces / r.validPieces - 1) <= 0.25);
    if (!ps.length) continue;
    r.peers = ps.map((o) => o.branchId);
    r.peerLp = per1000(ps.reduce((s, o) => s + o.validLiters, 0), ps.reduce((s, o) => s + o.validPieces, 0));
  }
  return { rows, net, prevNet, at: (id: number) => rows.get(id)!, netFor: (sub: number[]) => ({ cur: netOf(cur, sub), prev: netOf(before, sub) }) };
}
