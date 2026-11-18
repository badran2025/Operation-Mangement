/**
 * Diesel by machine. The boiler's diesel is shared between the machines in
 * proportion to the steam each one drew, counted by the time its steam valve
 * was really open:
 *   dryer : cycles × (cycle minutes / 60) × valve-open factor   → steam hours
 *   press : pieces × presses per piece × seconds per press / 3600 → steam hours
 *   other : hours of use                                          → steam hours
 *   steam kg = steam hours × the machine's rated kg/h
 *   share    = steam kg / all steam kg of the branch
 *   litres   = branch diesel litres × share, cost = litres × price per litre
 */
export type SteamType = "dryer" | "press" | "other";
export type SteamSettings = {
  dryer_kg_h: number; press_kg_h: number; dryer_cycle_min: number;
  dryer_valve_factor: number; presses_per_item: number; seconds_per_press: number;
  /** kg of steam the boiler makes from one litre of diesel */
  steam_per_liter: number;
  /** a steam test this much (%) above the catalogue is flagged */
  test_alert_pct: number;
  /** a machine is due for a new steam test after this many days */
  test_every_days: number;
  /** unexplained diesel rising this many points above its usual level is flagged */
  unexplained_jump_pct: number;
};
export const DEFAULT_STEAM: SteamSettings = {
  dryer_kg_h: 60, press_kg_h: 17.5, dryer_cycle_min: 20, dryer_valve_factor: 0.68, presses_per_item: 12, seconds_per_press: 3.5,
  steam_per_liter: 11, test_alert_pct: 20, test_every_days: 90, unexplained_jump_pct: 15,
};

/**
 * units: cycles / pieces / hours counted that period.
 * meterHours: hours the steam valve was really open (hour meter) — when given it replaces the counting assumptions.
 */
export type SteamMachine = { id: number; type: SteamType; units: number; kgH?: number | null; cycleMin?: number | null; meterHours?: number | null };
export type SteamShare = {
  id: number; type: SteamType; units: number; kgH: number; steamHours: number; steamKg: number;
  pct: number; liters: number; cost: number | null; unitLiters: number | null; unitCost: number | null;
};

/** BTU/hr on a nameplate → kg of steam per hour (the rule of thumb used here). */
export const btuToKgH = (btu: number) => btu / 2230;

export function ratedKgH(m: Pick<SteamMachine, "type" | "kgH">, s: SteamSettings): number {
  if (m.kgH && m.kgH > 0) return Number(m.kgH);
  return m.type === "dryer" ? s.dryer_kg_h : m.type === "press" ? s.press_kg_h : 0;
}

export function steamHours(m: SteamMachine, s: SteamSettings): number {
  if (m.meterHours !== null && m.meterHours !== undefined) return Math.max(Number(m.meterHours) || 0, 0);
  const u = Math.max(Number(m.units) || 0, 0);
  if (m.type === "dryer") return u * ((Number(m.cycleMin) || s.dryer_cycle_min) / 60) * s.dryer_valve_factor;
  if (m.type === "press") return u * ((s.presses_per_item * s.seconds_per_press) / 3600);
  return u;
}

/** Share the branch's diesel between its steam machines. Nothing ran → every share is 0. */
export function allocateDiesel(machines: SteamMachine[], totalLiters: number, pricePerL: number | null, s: SteamSettings = DEFAULT_STEAM) {
  const base = machines.map((m) => {
    const kgH = ratedKgH(m, s), hours = steamHours(m, s);
    return { m, kgH, hours, kg: hours * kgH };
  });
  const totalKg = base.reduce((a, b) => a + b.kg, 0);
  const rows: SteamShare[] = base.map(({ m, kgH, hours, kg }) => {
    const share = totalKg > 0 ? kg / totalKg : 0;
    const liters = totalLiters * share;
    const units = Math.max(Number(m.units) || 0, 0);
    return {
      id: m.id, type: m.type, units, kgH, steamHours: hours, steamKg: kg, pct: share * 100, liters,
      cost: pricePerL === null ? null : liters * pricePerL,
      unitLiters: units > 0 ? liters / units : null,
      unitCost: units > 0 && pricePerL !== null ? (liters / units) * pricePerL : null,
    };
  });
  // the diesel the machines' steam accounts for, and what is left over
  const expectedLiters = totalKg / s.steam_per_liter;
  const unexplained = totalLiters - expectedLiters;
  return {
    rows, totalKg, expectedLiters, unexplained,
    unexplainedPct: totalLiters > 0 ? (unexplained / totalLiters) * 100 : null,
    totalPct: rows.reduce((a, r) => a + r.pct, 0),
    totalLiters: rows.reduce((a, r) => a + r.liters, 0),
    totalCost: pricePerL === null ? null : rows.reduce((a, r) => a + (r.cost ?? 0), 0),
  };
}

type DipLite = { tank_id: number; read_at: string; id: number; liters: number | null; kind: string };
/**
 * Litres burnt in [from, to): for each tank, every drop between two readings
 * whose later reading falls in the period (a jump up after a delivery is not use).
 */
export function litersUsedBetween(dips: DipLite[], from: number, to: number): { liters: number; readings: number } {
  const byTank = new Map<number, DipLite[]>();
  for (const d of dips) if (d.liters !== null) byTank.set(d.tank_id, [...(byTank.get(d.tank_id) ?? []), d]);
  let liters = 0, readings = 0;
  for (const list of byTank.values()) {
    list.sort((a, b) => new Date(a.read_at).getTime() - new Date(b.read_at).getTime() || a.id - b.id);
    for (let i = 1; i < list.length; i++) {
      const t = new Date(list[i].read_at).getTime();
      if (t < from || t >= to || list[i].kind === "after") continue;
      liters += Math.max(Number(list[i - 1].liters) - Number(list[i].liters), 0);
      readings++;
    }
  }
  return { liters: Math.round(liters * 10) / 10, readings };
}

/** Sum of increases between consecutive hour-meter readings whose later reading falls in [from, to] (days, "YYYY-MM-DD"). */
export function meterHoursBetween(readings: { day: string; meter_reading: number | null }[], from: string, toExclusive: string): number | null {
  const list = readings.filter((r) => r.meter_reading !== null).sort((a, b) => a.day.localeCompare(b.day));
  let h = 0, any = false;
  for (let i = 1; i < list.length; i++) {
    if (list[i].day < from || list[i].day >= toExclusive) continue;
    h += Math.max(Number(list[i].meter_reading) - Number(list[i - 1].meter_reading), 0);
    any = true;
  }
  return any ? Math.round(h * 100) / 100 : null;
}
