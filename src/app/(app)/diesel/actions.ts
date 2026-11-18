"use server";
import { revalidatePath } from "next/cache";
import { requireActive, requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/components/ActionForm";
import { getT } from "@/lib/i18n/server";
import { friendlyError } from "@/lib/server-errors";

const refreshAll = () => revalidatePath("/", "layout");
const num = (v: string | null | undefined) => (v === null || v === undefined || String(v).trim() === "" ? null : Number(v));

async function dieselError(message: string) {
  const { t } = await getT();
  const E = t.diesel.errors;
  const m = message.toLowerCase();
  if (m.includes("diesel bad date")) return E.badDate;
  if (m.includes("diesel ordered required")) return E.ordered;
  if (m.includes("diesel readings required")) return E.readings;
  if (m.includes("diesel bad reading")) return E.badReading;
  if (m.includes("diesel after below before")) return E.afterBelow;
  if (m.includes("diesel tank not in branch")) return E.tank;
  return friendlyError(message);
}

export async function recordRefuel(input: {
  branchId: number; date: string; ordered: string; supplier: string; price: string; invoice: string; notes: string;
  dips: { tank_id: number; before_cm: string; after_cm: string }[];
}): Promise<{ id?: number; error?: string }> {
  const { supabase } = await requireActive();
  const { t } = await getT();
  const dips = input.dips.map((d) => ({ tank_id: d.tank_id, before_cm: num(d.before_cm), after_cm: num(d.after_cm) }));
  if (dips.some((d) => d.before_cm === null || d.after_cm === null)) return { error: t.diesel.errors.readings };
  const { data, error } = await supabase.rpc("record_diesel_refuel", {
    p_branch_id: input.branchId, p_date: input.date, p_ordered: num(input.ordered) as number, p_dips: dips,
    p_supplier: input.supplier, p_price: num(input.price) as number, p_invoice: input.invoice, p_notes: input.notes,
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

export async function recordCheck(input: { branchId: number; notes: string; dips: { tank_id: number; cm: string }[] }): Promise<{ error?: string }> {
  const { supabase } = await requireActive();
  const { t } = await getT();
  const dips = input.dips.map((d) => ({ tank_id: d.tank_id, cm: num(d.cm) }));
  if (dips.some((d) => d.cm === null)) return { error: t.diesel.errors.readings };
  const { error } = await supabase.rpc("record_diesel_check", { p_branch_id: input.branchId, p_dips: dips, p_notes: input.notes });
  if (error) return { error: await dieselError(error.message) };
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
  const shape = String(fd.get("shape") ?? "box");
  const row = {
    branch_id: branchId, label: String(fd.get("label") ?? "").trim() || "Tank", shape,
    length_cm: num(String(fd.get("length_cm") ?? "")), width_cm: shape === "box" ? num(String(fd.get("width_cm") ?? "")) : null,
    height_cm: shape === "horizontal_cylinder" ? null : num(String(fd.get("height_cm") ?? "")),
    diameter_cm: shape === "box" ? null : num(String(fd.get("diameter_cm") ?? "")),
    confirmed: fd.get("confirmed") === "on", active: fd.get("active") !== null ? fd.get("active") === "on" : true,
    notes: String(fd.get("notes") ?? "").trim() || null,
  };
  if (shape === "vertical_cylinder") row.length_cm = null;
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
