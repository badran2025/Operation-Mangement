/**
 * Diesel performance: diesel used by a branch compared with the work it did.
 * Main measure: litres per 1,000 pieces. Plain arithmetic on the tank readings,
 * the deliveries, the pieces and the opening hours; nothing is assumed about the machines.
 */

const DAY = 86400000;

export type ReadingLite = { id: number; tank_id: number; read_at: string; liters: number | null; kind: string };

/**
 * What the tanks lost between readings. A delivery is never use: its "before"
 * and "after" readings mark the jump up. Between any two other consecutive
 * readings of a tank, the drop is the diesel burnt, spread evenly over the time
 * between them, and priced at the price of the fuel that was in the tank
 * (the delivery made at or before the first of the two readings).
 */
export type Segment = { from: number; to: number; liters: number; price: number | null };
export function segmentsOf(readings: ReadingLite[], priceAt: (ms: number) => number | null) {
  const byTank = new Map<number, ReadingLite[]>();
  for (const r of readings) if (r.liters !== null) byTank.set(r.tank_id, [...(byTank.get(r.tank_id) ?? []), r]);
  const segs: Segment[] = [];
  let start = -Infinity, end = Infinity; // the time every tank has readings for
  for (const list of byTank.values()) {
    list.sort((a, b) => Date.parse(a.read_at) - Date.parse(b.read_at) || a.id - b.id);
    start = Math.max(start, Date.parse(list[0].read_at));
    end = Math.min(end, Date.parse(list[list.length - 1].read_at));
    for (let i = 1; i < list.length; i++) {
      if (list[i].kind === "after") continue; // the jump of a delivery
      const a = Date.parse(list[i - 1].read_at), b = Date.parse(list[i].read_at);
      const drop = Math.max(Number(list[i - 1].liters) - Number(list[i].liters), 0);
      if (b > a && drop > 0) segs.push({ from: a, to: b, liters: drop, price: priceAt(a) });
    }
  }
  return { segs, start: byTank.size ? start : null, end: byTank.size ? end : null };
}

/** Litres and their cost inside [from, to), each segment counted for the part of its time inside. */
export function burntIn(segs: Segment[], from: number, to: number) {
  let liters = 0, cost = 0, unpricedL = 0;
  for (const s of segs) {
    const part = Math.min(s.to, to) - Math.max(s.from, from);
    if (part <= 0) continue;
    const l = (s.liters * part) / (s.to - s.from);
    liters += l;
    if (s.price === null) unpricedL += l; else cost += l * s.price;
  }
  return { liters: Math.round(liters * 10) / 10, cost: Math.round(cost * 100) / 100, unpricedL: Math.round(unpricedL * 10) / 10 };
}

export type HoursRow = { weekday: number; open_time: string | null; close_time: string | null; is_24h: boolean; is_closed: boolean };
const toH = (t: string | null) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h + (m || 0) / 60; };
export function hoursOnWeekday(rows: HoursRow[], weekday: number): number {
  const r = rows.find((x) => x.weekday === weekday);
  if (!r || r.is_closed) return 0;
  if (r.is_24h) return 24;
  const o = toH(r.open_time), c = toH(r.close_time);
  if (o === null || c === null) return 0;
  return c > o ? c - o : 24 - o + c; // closes after midnight
}

/**
 * The hours a branch worked inside [from, to): its opening hours (Riyadh days,
 * a day cut by the edge counted for its share) less the time it was stopped by
 * maintenance tickets. The same days as the litres, so litres per hour stays true
 * for a month that is only partly known.
 */
export function hoursBetween(rows: HoursRow[], from: number, to: number, stops: { started_at: string; ended_at: string | null }[], now = Date.now()) {
  if (!rows.length || to <= from) return null;
  const RIYADH = 3 * 3600000;
  let scheduled = 0;
  for (let d = Math.floor((from + RIYADH) / DAY) * DAY - RIYADH; d < to; d += DAY) {
    const share = (Math.min(d + DAY, to) - Math.max(d, from)) / DAY;
    if (share > 0) scheduled += share * hoursOnWeekday(rows, new Date(d + RIYADH).getUTCDay());
  }
  // overlapping stops are counted once
  const spans = stops.map((s) => [Math.max(Date.parse(s.started_at), from), Math.min(s.ended_at ? Date.parse(s.ended_at) : now, to)] as [number, number])
    .filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  let stopped = 0, cur: [number, number] | null = null;
  for (const s of spans) {
    if (cur && s[0] <= cur[1]) cur[1] = Math.max(cur[1], s[1]);
    else { if (cur) stopped += cur[1] - cur[0]; cur = [...s] as [number, number]; }
  }
  if (cur) stopped += cur[1] - cur[0];
  const stoppedH = stopped / 3600000;
  return { scheduled, stopped: stoppedH, actual: Math.max(scheduled - stoppedH, 0) };
}

export const per1000 = (v: number | null, pieces: number | null) => (v !== null && pieces ? (v / pieces) * 1000 : null);
