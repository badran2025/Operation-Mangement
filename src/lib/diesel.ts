/**
 * Diesel maths shared by the pages. The database (tank_liters) is the source of
 * truth for what gets saved; this mirrors it so forms can show litres while typing.
 */
export type Tank = {
  id: number; branch_id: number; label: string; shape: "box" | "vertical_cylinder" | "horizontal_cylinder";
  length_cm: number | null; width_cm: number | null; height_cm: number | null; diameter_cm: number | null;
  confirmed: boolean; notes: string | null; active: boolean; sort: number; measure_by: "liters" | "cm"; liters_known: boolean;
  capacity_l: number | null; liters_per_cm: number | null; calibration_points: number;
  last_cm: number | null; last_liters: number | null; last_read_at: string | null;
};
export type Point = { tank_id: number; level_cm: number; liters: number };
export type Dip = { tank_id: number; branch_id: number; read_at: string; id: number; liters: number | null; level_cm?: number; kind: "check" | "before" | "after"; refuel_id?: number | null };

export const SHAPES = ["box", "vertical_cylinder", "horizontal_cylinder"] as const;

export function fullCm(t: Pick<Tank, "shape" | "height_cm" | "diameter_cm">): number | null {
  return t.shape === "horizontal_cylinder" ? t.diameter_cm : t.height_cm;
}

export function tankLiters(t: Tank, cm: number, points: Point[] = []): number | null {
  if (!Number.isFinite(cm)) return null;
  const pts = points.filter((p) => p.tank_id === t.id).sort((a, b) => a.level_cm - b.level_cm);
  if (pts.length) {
    const lo = [...pts].reverse().find((p) => p.level_cm <= cm) ?? { level_cm: 0, liters: 0 };
    const hi = pts.find((p) => p.level_cm >= cm);
    if (!hi) return round1(lo.liters);
    if (hi.level_cm === lo.level_cm) return round1(hi.liters);
    return round1(lo.liters + ((hi.liters - lo.liters) * (cm - lo.level_cm)) / (hi.level_cm - lo.level_cm));
  }
  const L = Number(t.length_cm), W = Number(t.width_cm), H = Number(t.height_cm), D = Number(t.diameter_cm);
  if (t.shape === "box") return round1((clamp(cm, 0, H || cm) * L * W) / 1000);
  if (t.shape === "vertical_cylinder") return round1((clamp(cm, 0, H || cm) * Math.PI * (D / 2) ** 2) / 1000);
  const r = D / 2, h = clamp(cm, 0, D);
  return round1((L * (r * r * Math.acos((r - h) / r) - (r - h) * Math.sqrt(Math.max(2 * r * h - h * h, 0)))) / 1000);
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Average litres used per day over the last `days`, per branch.
 * Use between two readings of a tank = earlier litres − later litres,
 * except when the later reading is the "after" of a refuel (that jump is the delivery).
 */
export function dailyUse(dips: Dip[], days = 30, now = Date.now()): Map<number, number> {
  const from = now - days * 86400000;
  const byTank = new Map<number, Dip[]>();
  for (const d of dips) if (d.liters !== null && new Date(d.read_at).getTime() >= from) byTank.set(d.tank_id, [...(byTank.get(d.tank_id) ?? []), d]);
  const used = new Map<number, number>(), span = new Map<number, number>();
  for (const list of byTank.values()) {
    list.sort((a, b) => new Date(a.read_at).getTime() - new Date(b.read_at).getTime() || a.id - b.id);
    if (list.length < 2) continue;
    let u = 0;
    for (let i = 1; i < list.length; i++) if (list[i].kind !== "after") u += Math.max(Number(list[i - 1].liters) - Number(list[i].liters), 0);
    const s = (new Date(list[list.length - 1].read_at).getTime() - new Date(list[0].read_at).getTime()) / 86400000;
    const b = list[0].branch_id;
    used.set(b, (used.get(b) ?? 0) + u);
    span.set(b, Math.max(span.get(b) ?? 0, s));
  }
  const out = new Map<number, number>();
  for (const [b, u] of used) { const s = span.get(b) ?? 0; if (s >= 0.5) out.set(b, Math.round((u / s) * 10) / 10); }
  return out;
}

export type RefuelLite = { refuel_date: string; liters: number; before_liters: number | null };

/**
 * One branch's diesel picture from its readings and deliveries:
 * stock at the last reading and estimated now, use per day / week / month,
 * and when the next delivery is expected (when stock falls to the usual
 * level at which it gets refilled, or else the usual gap between deliveries).
 */
export function branchDiesel(tanks: Tank[], dips: Dip[], refuels: RefuelLite[], branchId: number, now = Date.now()) {
  const active = tanks.filter((x) => x.active);
  const known = active.filter((x) => x.liters_known);
  const lastKnown = known.map((x) => dips.filter((d) => d.tank_id === x.id && d.liters !== null)
    .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime() || b.id - a.id)[0]);
  const complete = known.length > 0 && known.length === active.length && lastKnown.every(Boolean);
  const stockAt = complete ? lastKnown.reduce((s, d) => s + Number(d!.liters), 0) : null;
  const lastAt = complete ? Math.max(...lastKnown.map((d) => new Date(d!.read_at).getTime())) : null;
  const rate = dailyUse(dips.filter((d) => d.branch_id === branchId), 90, now).get(branchId) ?? null;
  const stockNow = stockAt !== null && lastAt !== null ? Math.max(0, stockAt - (rate ?? 0) * ((now - lastAt) / 86400000)) : null;
  const cap = active.reduce((s, x) => s + Number(x.capacity_l ?? 0), 0);

  const sorted = [...refuels].sort((a, b) => a.refuel_date.localeCompare(b.refuel_date));
  const befores = sorted.map((r) => r.before_liters).filter((v): v is number => v !== null).map(Number);
  const refillAt = befores.length ? befores.reduce((a, b) => a + b, 0) / befores.length : null;
  const gaps = sorted.slice(1).map((r, i) => (new Date(r.refuel_date).getTime() - new Date(sorted[i].refuel_date).getTime()) / 86400000).filter((g) => g > 0);
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  const last = sorted.at(-1) ?? null;

  let next: number | null = null;
  if (rate && stockNow !== null && refillAt !== null) next = now + Math.max(0, (stockNow - refillAt) / rate) * 86400000;
  else if (last && avgGap) next = new Date(last.refuel_date).getTime() + avgGap * 86400000;

  const cmOnly = active.filter((x) => !x.liters_known).map((x) => ({ tank: x, lastCm: dips.filter((d) => d.tank_id === x.id && d.level_cm !== undefined)
    .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime() || b.id - a.id)[0]?.level_cm ?? null }));

  return { active, cap, stockAt, stockNow, lastAt, rate, weekly: rate ? rate * 7 : null, monthly: rate ? rate * 30 : null, refillAt, avgGap, last, next, cmOnly };
}

/**
 * Build a cylinder's calibration table from its deliveries.
 * Start from a delivery made when the tank was empty (0 cm): litres there = 0.
 * Each later delivery adds a point: litres at "after" = litres at "before" + invoice litres,
 * as long as its "before" falls inside the part of the tank already known.
 */
export type Segment = { date: string; from_cm: number; to_cm: number; liters: number };
export function calibrationFromDeliveries(segments: Segment[]): { level_cm: number; liters: number }[] {
  const pts: { level_cm: number; liters: number }[] = [];
  const sorted = [...segments].sort((a, b) => a.date.localeCompare(b.date));
  const start = sorted.findIndex((s) => s.from_cm === 0);
  if (start < 0) return [];
  pts.push({ level_cm: 0, liters: 0 });
  const at = (cm: number) => {
    const lo = [...pts].reverse().find((p) => p.level_cm <= cm)!;
    const hi = pts.find((p) => p.level_cm >= cm);
    if (!hi) return null;
    return hi.level_cm === lo.level_cm ? lo.liters : lo.liters + ((hi.liters - lo.liters) * (cm - lo.level_cm)) / (hi.level_cm - lo.level_cm);
  };
  for (const s of sorted.slice(start)) {
    const max = pts[pts.length - 1].level_cm;
    if (s.to_cm <= max) continue;
    const base = s.from_cm === 0 ? 0 : at(s.from_cm);
    if (base === null) continue;
    pts.push({ level_cm: s.to_cm, liters: Math.round((base + s.liters) * 10) / 10 });
    pts.sort((a, b) => a.level_cm - b.level_cm);
  }
  return pts;
}
