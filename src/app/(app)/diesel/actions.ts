"use server";
import { parseNum } from "@/lib/numbers";
import { revalidatePath } from "next/cache";
import { requireActive, requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/components/ActionForm";
import { getT } from "@/lib/i18n/server";
import { DIMS, SHAPES, calibrationFromDeliveries, geoLiters, type Dim, type Shape, type Tank } from "@/lib/diesel";
import { friendlyError } from "@/lib/server-errors";

const refreshAll = () => revalidatePath("/", "layout");
const num = (v: string | null | undefined) => parseNum(v);

async function dieselError(message: string) {
  const { t } = await getT();
  const E = t.diesel.errors;
  const m = message.toLowerCase();
  if (m.includes("diesel bad total")) return E.badTotal;
  if (m.includes("diesel bad date")) return E.badDate;
  if (m.includes("diesel ordered required")) return E.ordered;
  if (m.includes("diesel readings required")) return E.readings;
  if (m.includes("diesel bad reading")) return E.badReading;
  if (m.includes("diesel after below before")) return E.afterBelow;
  if (m.includes("diesel tank not in branch")) return E.tank;
  return friendlyError(message);
}

type DipIn = { tank_id: number; before_cm?: string; after_cm?: string; before_l?: string; after_l?: string };
type RefuelIn = { branchId: number; date: string; invoiceLiters: string; supplier: string; total: string; invoice: string; notes: string; dips: DipIn[] };
/** readings as typed (cm or litres) → numbers for the database; null when a value is missing */
function cleanDips(dips: DipIn[]) {
  const out = dips.map((d) => d.before_l !== undefined || d.after_l !== undefined
    ? { tank_id: d.tank_id, before_l: parseNum(d.before_l), after_l: parseNum(d.after_l) }
    : { tank_id: d.tank_id, before_cm: parseNum(d.before_cm), after_cm: parseNum(d.after_cm) });
  return out.some((d) => Object.values(d).some((v) => v === null)) ? null : out;
}

export async function recordRefuel(input: RefuelIn): Promise<{ id?: number; error?: string }> {
  const { supabase } = await requireActive();
  const { t } = await getT();
  const dips = cleanDips(input.dips);
  if (!dips) return { error: t.diesel.errors.readings };
  const { data, error } = await supabase.rpc("record_diesel_refuel", {
    p_branch_id: input.branchId, p_date: input.date, p_invoice_liters: num(input.invoiceLiters) as number, p_dips: dips,
    p_supplier: input.supplier, p_total: num(input.total) as number, p_invoice: input.invoice, p_notes: input.notes,
  });
  if (error) return { error: await dieselError(error.message) };
  refreshAll();
  return { id: data as number };
}

/** Change a recorded delivery: its figures and its readings. */
export async function updateRefuel(id: number, input: RefuelIn): Promise<{ id?: number; error?: string }> {
  const { supabase } = await requireActive();
  const { t } = await getT();
  const dips = cleanDips(input.dips);
  if (!dips) return { error: t.diesel.errors.readings };
  const { data, error } = await supabase.rpc("update_diesel_refuel", {
    p_refuel_id: id, p_date: input.date, p_invoice_liters: num(input.invoiceLiters) as number, p_dips: dips,
    p_supplier: input.supplier, p_total: num(input.total) as number, p_invoice: input.invoice, p_notes: input.notes,
  });
  if (error) return { error: await dieselError(error.message) };
  refreshAll();
  return { id: data as number };
}

/** Photos are uploaded by the browser; this registers them on the delivery. */
export async function addRefuelFiles(refuelId: number, files: { path: string; type: string }[]): Promise<{ error?: string }> {
  const { supabase } = await requireActive();
  if (!files.length) return {};
  const { error } = await supabase.from("diesel_refuel_files").insert(files.map((f) => ({ refuel_id: refuelId, file_path: f.path, mime_type: f.type })));
  if (error) return { error: await friendlyError(error.message) };
  refreshAll();
  return {};
}

export async function deleteRefuel(id: number): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  const { data: files } = await supabase.from("diesel_refuel_files").select("file_path").eq("refuel_id", id);
  const { error } = await supabase.from("diesel_refuels").delete().eq("id", id);
  if (error) return { error: await friendlyError(error.message) };
  if (files?.length) await supabase.storage.from("diesel-files").remove(files.map((f) => f.file_path));
  refreshAll();
  return {};
}

// ---------- tanks (admin) ----------
export async function saveTank(branchId: number, id: number | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const E = t.diesel.errors;
  const raw = String(fd.get("shape") ?? "box");
  if (!(SHAPES as readonly string[]).includes(raw)) return { error: E.shape };
  const shape = raw as Shape;
  const need = DIMS[shape];
  const dim = (d: Dim) => (need.includes(d) ? num(String(fd.get(d) ?? "")) : null);
  const row = {
    branch_id: branchId, label: String(fd.get("label") ?? "").trim() || "Tank", shape,
    length_cm: dim("length_cm"), width_cm: dim("width_cm"), height_cm: dim("height_cm"), diameter_cm: dim("diameter_cm"),
    confirmed: fd.get("confirmed") === "on", active: fd.get("active") !== null ? fd.get("active") === "on" : true,
    measure_by: String(fd.get("measure_by") ?? "") === "cm" ? "cm" : "liters",
    entry_unit: String(fd.get("entry_unit") ?? "") === "liters" ? "liters" : "cm",
    notes: String(fd.get("notes") ?? "").trim() || null,
  };
  if (need.some((d) => !(Number(row[d]) > 0))) return { error: E.dims };
  if (shape === "horizontal_oval" && Number(row.width_cm) < Number(row.height_cm)) return { error: E.ovalWide };
  if (shape === "vertical_oval" && Number(row.height_cm) < Number(row.width_cm)) return { error: E.ovalTall };
  const { error } = id ? await supabase.from("diesel_tanks").update(row).eq("id", id) : await supabase.from("diesel_tanks").insert(row);
  if (error) return { error: await friendlyError(error.message) };
  refreshAll();
  return { ok: t.diesel.form.saved };
}

export async function deleteTank(id: number): Promise<{ error?: string; notice?: string }> {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const { count } = await supabase.from("diesel_dips").select("id", { count: "exact", head: true }).eq("tank_id", id);
  if (count) {
    await supabase.from("diesel_tanks").update({ active: false }).eq("id", id);
    refreshAll();
    return { notice: t.diesel.tanks.hasReadings };
  }
  const { error } = await supabase.from("diesel_tanks").delete().eq("id", id);
  if (error) return { error: await friendlyError(error.message) };
  refreshAll();
  return {};
}

/** Replace a tank's calibration table from "cm litres" lines. */
export async function saveCalibration(tankId: number, text: string): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const rows: { tank_id: number; level_cm: number; liters: number }[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [a, b] = line.replace(/[,،=:]/g, " ").split(/\s+/).map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return { error: t.diesel.errors.calibration };
    rows.push({ tank_id: tankId, level_cm: a, liters: b });
  }
  const unique = [...new Map(rows.map((r) => [r.level_cm, r])).values()];
  const del = await supabase.from("diesel_tank_points").delete().eq("tank_id", tankId);
  if (del.error) return { error: await friendlyError(del.error.message) };
  if (unique.length) {
    const ins = await supabase.from("diesel_tank_points").insert(unique);
    if (ins.error) return { error: await friendlyError(ins.error.message) };
  }
  refreshAll();
  return {};
}

/** Build a cm tank's calibration table from its deliveries (needs one delivery from empty). */
export async function buildCalibration(tankId: number): Promise<{ error?: string; points?: number }> {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const { data: dips } = await supabase.from("diesel_dips").select("refuel_id, kind, level_cm, read_at").eq("tank_id", tankId).not("refuel_id", "is", null);
  const ids = [...new Set((dips ?? []).map((d) => d.refuel_id as number))];
  if (!ids.length) return { error: t.diesel.tanks.noSegments };
  const [{ data: refs }, { data: allDips }, { data: tank }] = await Promise.all([
    supabase.from("diesel_refuels").select("id, refuel_date, liters").in("id", ids),
    supabase.from("diesel_dips").select("refuel_id, tank_id").in("refuel_id", ids),
    supabase.from("diesel_tanks").select("shape, length_cm, width_cm, height_cm, diameter_cm").eq("id", tankId).maybeSingle(),
  ]);
  // only deliveries that went into this tank alone: the invoice litres are all this tank's
  const alone = new Set(ids.filter((id) => new Set((allDips ?? []).filter((d) => d.refuel_id === id).map((d) => d.tank_id)).size === 1));
  const segments = (refs ?? []).filter((r) => alone.has(r.id)).map((r) => {
    const mine = (dips ?? []).filter((d) => d.refuel_id === r.id);
    return { date: `${r.refuel_date}|${mine[0]?.read_at ?? ""}`, from_cm: Number(mine.find((d) => d.kind === "before")?.level_cm), to_cm: Number(mine.find((d) => d.kind === "after")?.level_cm), liters: Number(r.liters) };
  }).filter((s) => Number.isFinite(s.from_cm) && Number.isFinite(s.to_cm));
  const pts = calibrationFromDeliveries(segments, tank ? (cm) => geoLiters(tank as Pick<Tank, "shape" | Dim>, cm) : undefined);
  if (!pts.length) return { error: t.diesel.tanks.needsEmpty };
  const del = await supabase.from("diesel_tank_points").delete().eq("tank_id", tankId);
  if (del.error) return { error: await friendlyError(del.error.message) };
  const ins = await supabase.from("diesel_tank_points").insert(pts.map((p) => ({ tank_id: tankId, ...p })));
  if (ins.error) return { error: await friendlyError(ins.error.message) };
  refreshAll();
  return { points: pts.length };
}

// ---------- monthly figures (admin) ----------
export type MonthRow = { branch_id: number; pieces: string; blankets: string; liters: string; cost: string; estimated: boolean };
/** Save one month's figures for every branch; a branch left completely empty is removed for that month. */
export async function saveMonthFigures(month: string, rows: MonthRow[]): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const E = t.diesel.perf.errors;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: E.bad };
  const keep: Record<string, unknown>[] = [], drop: number[] = [];
  for (const r of rows) {
    const v = { pieces: parseNum(r.pieces), blankets: parseNum(r.blankets), liters: parseNum(r.liters), cost: parseNum(r.cost) };
    if (Object.values(v).some((x) => x !== null && x < 0)) return { error: E.bad };
    if (v.pieces !== null && v.blankets !== null && v.blankets > v.pieces) return { error: E.blankets };
    if (Object.values(v).every((x) => x === null)) { drop.push(r.branch_id); continue; }
    keep.push({ branch_id: r.branch_id, month: `${month}-01`, pieces: v.pieces === null ? null : Math.round(v.pieces), blankets: v.blankets === null ? null : Math.round(v.blankets), liters: v.liters, cost: v.cost, estimated: r.estimated });
  }
  if (keep.length) {
    const { error } = await supabase.from("branch_months").upsert(keep, { onConflict: "branch_id,month" });
    if (error) return { error: await friendlyError(error.message) };
  }
  if (drop.length) {
    const { error } = await supabase.from("branch_months").delete().eq("month", `${month}-01`).in("branch_id", drop);
    if (error) return { error: await friendlyError(error.message) };
  }
  refreshAll();
  return {};
}

/** A level reading of every tank of a branch, without a delivery. */
export async function recordReading(branchId: number, readings: { tank_id: number; cm?: string; liters?: string }[], notes: string, at?: string): Promise<{ error?: string }> {
  const { supabase } = await requireActive();
  const { t } = await getT();
  const dips = readings.map((r) => (r.liters !== undefined ? { tank_id: r.tank_id, liters: parseNum(r.liters) } : { tank_id: r.tank_id, cm: parseNum(r.cm) }));
  if (!dips.length || dips.some((d) => ("liters" in d ? d.liters : d.cm) === null)) return { error: t.diesel.errors.readings };
  const when = at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : null;
  const { error } = await supabase.rpc("record_diesel_check", { p_branch_id: branchId, p_dips: dips, p_notes: notes, p_at: when });
  if (error) return { error: await dieselError(error.message) };
  refreshAll();
  return {};
}
