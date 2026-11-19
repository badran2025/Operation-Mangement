/**
 * Diesel maths shared by the pages. The database (tank_liters) is the source of
 * truth for what gets saved; this mirrors it so forms can show litres while typing.
 */
export const SHAPES = ["box", "vertical_cylinder", "horizontal_cylinder", "horizontal_oval", "vertical_oval", "horizontal_capsule", "vertical_capsule"] as const;
export type Shape = (typeof SHAPES)[number];
export type Dim = "length_cm" | "width_cm" | "height_cm" | "diameter_cm";
/** The dimensions each shape needs, in the order they are asked for. */
export const DIMS: Record<Shape, Dim[]> = {
  box: ["length_cm", "width_cm", "height_cm"],
  vertical_cylinder: ["diameter_cm", "height_cm"],
  horizontal_cylinder: ["diameter_cm", "length_cm"],
  horizontal_oval: ["width_cm", "height_cm", "length_cm"],
  vertical_oval: ["width_cm", "height_cm", "length_cm"],
  horizontal_capsule: ["diameter_cm", "length_cm"],
  vertical_capsule: ["diameter_cm", "height_cm"],
};
/** Litres per cm is the same at every depth only for these. */
export const STRAIGHT_SIDED: Shape[] = ["box", "vertical_cylinder"];

export type Tank = {
  id: number; branch_id: number; label: string; shape: Shape;
  length_cm: number | null; width_cm: number | null; height_cm: number | null; diameter_cm: number | null;
  confirmed: boolean; notes: string | null; active: boolean; sort: number; measure_by: "liters" | "cm"; liters_known: boolean; entry_unit?: "cm" | "liters";
  capacity_l: number | null; liters_per_cm: number | null; calibration_points: number;
  last_cm: number | null; last_liters: number | null; last_read_at: string | null;
};
export type Point = { tank_id: number; level_cm: number; liters: number };
export type Dip = { tank_id: number; branch_id: number; read_at: string; id: number; liters: number | null; level_cm?: number; kind: "check" | "before" | "after"; refuel_id?: number | null };

type Dims = Pick<Tank, "shape" | Dim>;

/** Dipstick reading when the tank is full. */
export function fullCm(t: Pick<Tank, "shape" | "height_cm" | "diameter_cm">): number | null {
  if (t.shape === "horizontal_cylinder" || t.shape === "horizontal_capsule") return t.diameter_cm === null ? null : Number(t.diameter_cm);
  if (t.shape === "vertical_capsule") return t.height_cm === null || t.diameter_cm === null ? null : Number(t.height_cm) + Number(t.diameter_cm);
  return t.height_cm === null ? null : Number(t.height_cm);
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const round1 = (v: number) => Math.round(v * 10) / 10;
/** Area (cm²) of a circle segment of height h, circle radius r. */
const segment = (r: number, h: number) => { h = clamp(h, 0, 2 * r); return r * r * Math.acos(clamp((r - h) / r, -1, 1)) - (r - h) * Math.sqrt(Math.max(2 * r * h - h * h, 0)); };
/** Volume (cm³) of a sphere cap of height h, sphere radius r. */
const cap = (r: number, h: number) => { h = clamp(h, 0, 2 * r); return (Math.PI * h * h * (3 * r - h)) / 3; };

/**
 * Litres from the dimensions alone (same formulas as the CalculatorSoup tank calculator).
 * Mirrors public.tank_geo_liters. Null when a dimension is missing.
 */
export function geoLiters(t: Dims, cm: number): number | null {
  const full = fullCm(t);
  if (full === null || !Number.isFinite(cm) || DIMS[t.shape].some((d) => !(Number(t[d]) > 0))) return null;
  const f = clamp(cm, 0, full);
  const L = Number(t.length_cm), W = Number(t.width_cm), H = Number(t.height_cm), D = Number(t.diameter_cm);
  let v: number;
  switch (t.shape) {
    case "box": v = f * L * W; break;
    case "vertical_cylinder": v = Math.PI * (D / 2) ** 2 * f; break;
    case "horizontal_cylinder": v = L * segment(D / 2, f); break;
    case "horizontal_oval": { const r = H / 2, a = Math.max(W - H, 0); v = L * (segment(r, f) + a * f); break; }
    case "vertical_oval": {
      const r = W / 2, a = Math.max(H - W, 0);
      v = L * (f <= r ? segment(r, f) : f <= r + a ? (Math.PI * r * r) / 2 + W * (f - r) : Math.PI * r * r + W * a - segment(r, H - f));
      break;
    }
    case "horizontal_capsule": { const r = D / 2; v = L * segment(r, f) + cap(r, f); break; }
    case "vertical_capsule": {
      const r = D / 2, a = H;
      v = f <= r ? cap(r, f) : f <= r + a ? (2 * Math.PI * r ** 3) / 3 + Math.PI * r * r * (f - r) : (4 * Math.PI * r ** 3) / 3 + Math.PI * r * r * a - cap(r, full - f);
      break;
    }
    default: return null;
  }
  return v / 1000;
}

/**
 * Interpolate inside a calibration table. Between two points the litres follow the
 * tank's own shape (so a lying cylinder fills slowly at the bottom and top, fast in
 * the middle); straight lines are used only when the dimensions are unknown.
 */
export function interpolate(pts: { level_cm: number; liters: number }[], cm: number, geo?: (cm: number) => number | null): number | null {
  const sorted = [...pts].sort((a, b) => a.level_cm - b.level_cm);
  const lo = [...sorted].reverse().find((p) => p.level_cm <= cm) ?? { level_cm: 0, liters: 0 };
  const hi = sorted.find((p) => p.level_cm >= cm);
  const g = geo?.(cm) ?? null, glo = geo?.(lo.level_cm) ?? null;
  if (!hi) return g === null || glo === null ? lo.liters : lo.liters + (g - glo) * (glo > 0 ? lo.liters / glo : 1);
  if (hi.level_cm === lo.level_cm) return hi.liters;
  const ghi = geo?.(hi.level_cm) ?? null;
  if (g !== null && glo !== null && ghi !== null && ghi - glo > 0) return lo.liters + ((hi.liters - lo.liters) * (g - glo)) / (ghi - glo);
  return lo.liters + ((hi.liters - lo.liters) * (cm - lo.level_cm)) / (hi.level_cm - lo.level_cm);
}

/** Litres at a dipstick reading. Mirrors public.tank_liters. */
export function tankLiters(t: Tank, cm: number, points: Point[] = []): number | null {
  if (!Number.isFinite(cm)) return null;
  const pts = points.filter((p) => p.tank_id === t.id).map((p) => ({ level_cm: Number(p.level_cm), liters: Number(p.liters) }));
  const v = pts.length ? interpolate(pts, cm, (c) => geoLiters(t, c)) : geoLiters(t, cm);
  return v === null ? null : round1(v);
}

/** "⌀100 × 200" style text of a tank's dimensions in cm. */
export function dimsText(t: Dims, f: (v: number | null) => string): string {
  return DIMS[t.shape].map((d) => (d === "diameter_cm" ? `⌀${f(t[d])}` : f(t[d]))).join(" × ");
}

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

export type RefuelLite = { id?: number; refuel_date: string; liters: number; before_liters: number | null };

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

  const sorted = [...refuels].sort((a, b) => a.refuel_date.localeCompare(b.refuel_date) || (a.id ?? 0) - (b.id ?? 0));
  const befores = sorted.map((r) => r.before_liters).filter((v): v is number => v !== null).map(Number);
  const refillAt = befores.length ? befores.reduce((a, b) => a + b, 0) / befores.length : null;
  const gaps = sorted.slice(1).map((r, i) => (new Date(r.refuel_date).getTime() - new Date(sorted[i].refuel_date).getTime()) / 86400000).filter((g) => g > 0);
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  const last = sorted.at(-1) ?? null;

  let next: number | null = null;
  if (rate && stockNow !== null && refillAt !== null) next = now + Math.max(0, (stockNow - refillAt) / rate) * 86400000;
  else if (last && avgGap) next = new Date(last.refuel_date).getTime() + avgGap * 86400000;

  // tanks whose stock can only be shown in cm: not calibrated yet, or calibrated after their last reading
  const latestOf = (id: number) => dips.filter((d) => d.tank_id === id).sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime() || b.id - a.id)[0];
  const cmOnly = active.filter((x) => !x.liters_known || (latestOf(x.id) && latestOf(x.id).liters === null)).map((x) => ({ tank: x, lastCm: dips.filter((d) => d.tank_id === x.id && d.level_cm !== undefined)
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
export function calibrationFromDeliveries(segments: Segment[], geo?: (cm: number) => number | null): { level_cm: number; liters: number }[] {
  const pts: { level_cm: number; liters: number }[] = [];
  const sorted = [...segments].sort((a, b) => a.date.localeCompare(b.date));
  const start = sorted.findIndex((s) => s.from_cm === 0);
  if (start < 0) return [];
  pts.push({ level_cm: 0, liters: 0 });
  // only inside the part already known; between points follow the tank's shape
  const at = (cm: number) => (cm > pts[pts.length - 1].level_cm ? null : interpolate(pts, cm, geo));
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

/** The dipstick height (cm) that holds `liters`, found by halves on the tank's own curve. Null if more than the tank holds. */
export function cmForLiters(t: Tank, liters: number, points: Point[] = []): number | null {
  const full = fullCm(t);
  if (full === null || !Number.isFinite(liters) || liters < 0) return null;
  const cap = tankLiters(t, full, points);
  if (cap === null || liters > cap + 0.05) return null;
  let lo = 0, hi = full;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if ((tankLiters(t, mid, points) ?? 0) < liters) lo = mid; else hi = mid; }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}
