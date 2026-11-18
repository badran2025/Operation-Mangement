"use server";
import { latinDigits, parseNum } from "@/lib/numbers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { friendlyError } from "@/lib/server-errors";

const CATS = ["chemicals", "packaging", "consumables", "tools", "other"];
const TEXT_KEYS = ["materials_how_to_order", "materials_policy"] as const;
const refreshAll = () => revalidatePath("/", "layout");
const num = (v: string) => (latinDigits(v).trim() === "" ? null : Number(latinDigits(v)));

export async function saveMaterial(input: {
  id?: number | null; name: string; category: string; unit: string; odooRef: string; notes: string; active: boolean;
  photoPath?: string | null; removePhoto?: boolean;
}): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  if (!input.name.trim()) return { error: t.branchesTab.required };
  const row: Record<string, unknown> = {
    name: input.name.trim(), category: CATS.includes(input.category) ? input.category : "other", unit: input.unit.trim() || null,
    odoo_ref: input.odooRef.trim() || null, notes: input.notes.trim() || null, active: input.active,
  };
  let oldPhoto: string | null = null;
  if (input.id && (input.photoPath || input.removePhoto)) {
    oldPhoto = (await supabase.from("materials").select("photo_path").eq("id", input.id).maybeSingle()).data?.photo_path ?? null;
  }
  if (input.photoPath) row.photo_path = input.photoPath;
  else if (input.removePhoto) row.photo_path = null;
  const { error } = input.id ? await supabase.from("materials").update(row).eq("id", input.id) : await supabase.from("materials").insert(row);
  if (error) return { error: await friendlyError(error.message) };
  if (oldPhoto) await supabase.storage.from("material-photos").remove([oldPhoto]);
  refreshAll();
  return {};
}

/** Add a material to a branch, or change its min / max there. */
export async function saveBranchMaterial(branchId: number, materialId: number, minS: string, maxS: string, notes: string): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const min = num(minS), max = num(maxS);
  if (!materialId) return { error: t.branchesTab.materials.choose };
  if ((min !== null && (isNaN(min) || min < 0)) || (max !== null && (isNaN(max) || max < 0)) || (min !== null && max !== null && max < min)) {
    return { error: t.branchesTab.materials.minMax };
  }
  const { error } = await supabase.from("branch_materials").upsert({ branch_id: branchId, material_id: materialId, min_qty: min, max_qty: max, notes: notes.trim() || null });
  if (error) return { error: await friendlyError(error.message) };
  refreshAll();
  return {};
}

export async function removeBranchMaterial(branchId: number, materialId: number): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("branch_materials").delete().eq("branch_id", branchId).eq("material_id", materialId);
  if (error) return { error: await friendlyError(error.message) };
  refreshAll();
  return {};
}

export async function deleteMaterial(id: number): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("materials").select("photo_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) return { error: await friendlyError(error.message) };
  if (data?.photo_path) await supabase.storage.from("material-photos").remove([data.photo_path]);
  refreshAll();
  return {};
}

export async function saveText(key: string, body: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireAdmin();
  if (!(TEXT_KEYS as readonly string[]).includes(key)) return {};
  const { error } = await supabase.from("app_texts").upsert({ key, body: body.trim() || null, updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return { error: await friendlyError(error.message) };
  refreshAll();
  return {};
}
