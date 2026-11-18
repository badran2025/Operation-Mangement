/**
 * Diesel maths shared by the pages. The database (tank_liters) is the source of
 * truth for what gets saved; this mirrors it so forms can show litres while typing.
 */
export type Tank = {
  id: number; branch_id: number; label: string; shape: "box" | "vertical_cylinder" | "horizontal_cylinder";
  length_cm: number | null; width_cm: number | null; height_cm: number | null; diameter_cm: number | null;
  confirmed: boolean; notes: string | null; active: boolean; sort: number;
  capacity_l: number | null; liters_per_cm: number | null; calibration_points: number;
  last_cm: number | null; last_liters: number | null; last_read_at: string | null;
};
export type Point = { tank_id: number; level_cm: number; liters: number };
export type Dip = { tank_id: number; branch_id: number; read_at: string; id: number; liters: number; kind: "check" | "before" | "after" };

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
  for (const d of dips) if (new Date(d.read_at).getTime() >= from) byTank.set(d.tank_id, [...(byTank.get(d.tank_id) ?? []), d]);
  const used = new Map<number, number>(), span = new Map<number, number>();
  for (const list of byTank.values()) {
    list.sort((a, b) => new Date(a.read_at).getTime() - new Date(b.read_at).getTime() || a.id - b.id);
    if (list.length < 2) continue;
    let u = 0;
    for (let i = 1; i < list.length; i++) if (list[i].kind !== "after") u += Math.max(list[i - 1].liters - list[i].liters, 0);
    const s = (new Date(list[list.length - 1].read_at).getTime() - new Date(list[0].read_at).getTime()) / 86400000;
    const b = list[0].branch_id;
    used.set(b, (used.get(b) ?? 0) + u);
    span.set(b, Math.max(span.get(b) ?? 0, s));
  }
  const out = new Map<number, number>();
  for (const [b, u] of used) { const s = span.get(b) ?? 0; if (s >= 0.5) out.set(b, Math.round((u / s) * 10) / 10); }
  return out;
}
