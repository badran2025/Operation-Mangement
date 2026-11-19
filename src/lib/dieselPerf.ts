/**
 * Diesel performance: diesel used by a branch compared with the work it did.
 * Main measure: litres per 1,000 pieces. Everything here is plain arithmetic on
 * the month's litres, cost, pieces and hours; nothing is assumed about the machines.
 */

export type ReadingLite = { tank_id: number; read_at: string; id: number; liters: number | null; kind: string };

/**
 * Litres burnt in [from, to). Between two readings of a tank the drop is spread
 * evenly over the days between them (a delivery's jump up is not use), so a
 * period between two deliveries that crosses a month end is split between the
 * months by days. complete = the readings reach from the start to the end of the period.
 */
export function usedBetween(readings: ReadingLite[], from: number, to: number) {
  const byTank = new Map<number, ReadingLite[]>();
  for (const r of readings) if (r.liters !== null) byTank.set(r.tank_id, [...(byTank.get(r.tank_id) ?? []), r]);
  let liters = 0, complete = byTank.size > 0;
  for (const list of byTank.values()) {
    list.sort((a, b) => Date.parse(a.read_at) - Date.parse(b.read_at) || a.id - b.id);
    if (Date.parse(list[0].read_at) > from || Date.parse(list[list.length - 1].read_at) < to) complete = false;
    for (let i = 1; i < list.length; i++) {
      if (list[i].kind === "after") continue;
      const drop = Math.max(Number(list[i - 1].liters) - Number(list[i].liters), 0);
      const a = Date.parse(list[i - 1].read_at), b = Date.parse(list[i].read_at);
      if (drop === 0 || b <= from || a >= to) continue;
      liters += b > a ? (drop * (Math.min(b, to) - Math.max(a, from))) / (b - a) : drop;
    }
  }
  return { liters: Math.round(liters * 10) / 10, complete };
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

/** Opening hours in a month (Riyadh calendar days) minus the time the branch was stopped. */
export function operatingHours(rows: HoursRow[], month: string, stops: { started_at: string; ended_at: string | null }[], now = Date.now()) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let scheduled = 0;
  for (let d = 1; d <= days; d++) scheduled += hoursOnWeekday(rows, new Date(Date.UTC(y, m - 1, d)).getUTCDay());
  if (!rows.length) return null;
  const from = Date.parse(`${month}-01T00:00:00+03:00`), to = Date.parse(`${y}-${String(m).padStart(2, "0")}-${days}T23:59:59+03:00`) + 1000;
  // overlapping stops are counted once
  const spans = stops.map((s) => [Math.max(Date.parse(s.started_at), from), Math.min(s.ended_at ? Date.parse(s.ended_at) : now, to)] as [number, number])
    .filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  let stopped = 0, cur: [number, number] | null = null;
  for (const s of spans) {
    if (cur && s[0] <= cur[1]) cur[1] = Math.max(cur[1], s[1]);
    else { if (cur) stopped += cur[1] - cur[0]; cur = [...s] as [number, number]; }
  }
  if (cur) stopped += cur[1] - cur[0];
  return Math.max(scheduled - stopped / 3600000, 0);
}

export type MonthFigures = {
  liters: number | null; cost: number | null; pieces: number | null; blankets: number | null; hours: number | null;
};
export const per1000 = (v: number | null, pieces: number | null) => (v !== null && pieces ? (v / pieces) * 1000 : null);

/**
 * Why the cost and the litres changed from one month to the next.
 * cost:   price effect = (price now − price before) × litres now; quantity effect = (litres now − before) × price before
 * litres: volume effect = (pieces now − before) × litres-per-piece before; efficiency effect = pieces now × (lpp now − lpp before)
 * Each pair adds up exactly to the change.
 */
export function bridge(now: MonthFigures, before: MonthFigures) {
  const p1 = now.liters && now.cost !== null ? now.cost / now.liters : null;
  const p0 = before.liters && before.cost !== null ? before.cost / before.liters : null;
  const cost = now.cost !== null && before.cost !== null && p1 !== null && p0 !== null && now.liters !== null && before.liters !== null
    ? { change: now.cost - before.cost, price: (p1 - p0) * now.liters, quantity: (now.liters - before.liters) * p0 } : null;
  const lpp1 = now.liters !== null && now.pieces ? now.liters / now.pieces : null;
  const lpp0 = before.liters !== null && before.pieces ? before.liters / before.pieces : null;
  const liters = lpp1 !== null && lpp0 !== null && now.pieces && before.pieces
    ? { change: now.liters! - before.liters!, volume: (now.pieces - before.pieces) * lpp0, efficiency: now.pieces * (lpp1 - lpp0) } : null;
  return { cost, liters };
}
