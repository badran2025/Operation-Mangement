"use server";
import { parseNum } from "@/lib/numbers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActive, requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/components/ActionForm";
import { getT } from "@/lib/i18n/server";
import { friendlyError } from "@/lib/server-errors";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => s(fd, k) || null;
const TIME = /^([01]\d|2[0-4]):[0-5]\d$/;
// branch data feeds every page (overview, branch cards, maintenance, workers), so refresh them all
const refreshAll = () => revalidatePath("/", "layout");

function safeUrl(v: string | null): string | null {
  if (!v) return null;
  try { return ["https:", "http:"].includes(new URL(v).protocol) ? v : null; } catch { return null; }
}

// ---------- branch ----------
export async function createBranch(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const nameAr = s(fd, "name_ar"), nameEn = s(fd, "name_en"), city = Number(s(fd, "city_id")), code = s(fd, "code").toUpperCase() || null;
  if (!nameAr || !nameEn || !city) return { error: t.branchesTab.required };
  const { data: last } = await supabase.from("branches").select("sort").eq("city_id", city).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from("branches").insert({ name_ar: nameAr, name_en: nameEn, code, city_id: city, sort: (last?.sort ?? 0) + 1 }).select("id").single();
  if (error) return { error: await friendlyError(error.message) };
  refreshAll();
  redirect(`/branches/${data.id}?s=info&edit=1`);
}

export async function updateBranchInfo(id: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const B = t.branchesTab.info;

  const hours: { branch_id: number; weekday: number; open_time: string | null; close_time: string | null; is_24h: boolean; is_closed: boolean }[] = [];
  for (let d = 0; d < 7; d++) {
    const mode = s(fd, `mode_${d}`);
    if (!mode) continue;
    const open = s(fd, `open_${d}`), close = s(fd, `close_${d}`);
    if (mode === "open" && (!TIME.test(open) || !TIME.test(close))) return { error: B.badTime };
    hours.push({ branch_id: id, weekday: d, open_time: mode === "open" ? open : null, close_time: mode === "open" ? (close === "00:00" ? "24:00" : close) : null, is_24h: mode === "24h", is_closed: mode === "closed" });
  }
  const ppmDay = s(fd, "ppm_weekday");
  const row = {
    name_ar: s(fd, "name_ar"), name_en: s(fd, "name_en"), code: s(fd, "code").toUpperCase() || null, status: s(fd, "status") || "active",
    phone: opt(fd, "phone"), address: opt(fd, "address"), map_url: safeUrl(opt(fd, "map_url")), hours_note: opt(fd, "hours_note"),
    ppm_weekday: ppmDay === "" ? null : Number(ppmDay), ppm_time: ppmDay === "" ? null : opt(fd, "ppm_time"), notes: opt(fd, "notes"),
  };
  if (!row.name_ar || !row.name_en) return { error: t.branchesTab.required };
  const { error } = await supabase.from("branches").update(row).eq("id", id);
  if (error) return { error: await friendlyError(error.message) };
  // save the new hours first, then drop days that were cleared: a failure never leaves the branch without hours
  if (hours.length) {
    const up = await supabase.from("branch_hours").upsert(hours, { onConflict: "branch_id,weekday" });
    if (up.error) return { error: await friendlyError(up.error.message) };
  }
  const kept = hours.map((h) => h.weekday);
  const del = kept.length
    ? await supabase.from("branch_hours").delete().eq("branch_id", id).not("weekday", "in", `(${kept.join(",")})`)
    : await supabase.from("branch_hours").delete().eq("branch_id", id);
  if (del.error) return { error: await friendlyError(del.error.message) };
  refreshAll();
  return { ok: B.saved };
}

// ---------- branch files ----------
export async function saveBranchFile(input: {
  branchId: number; id?: number | null; kind: string; title: string; number: string; expiry: string; notes: string;
  filePath?: string | null; mime?: string | null;
}): Promise<{ error?: string }> {
  const { supabase, user } = await requireAdmin();
  const { t } = await getT();
  const title = input.title.trim() || t.branchesTab.files.kinds[input.kind] || input.kind;
  const row: Record<string, unknown> = {
    branch_id: input.branchId, kind: input.kind, title, number: input.number.trim() || null,
    expiry_date: input.expiry || null, notes: input.notes.trim() || null,
  };
  if (input.filePath) { row.file_path = input.filePath; row.mime_type = input.mime ?? null; row.uploaded_by = user.id; }
  let oldPath: string | null = null;
  if (input.id) {
    if (input.filePath) oldPath = (await supabase.from("branch_files").select("file_path").eq("id", input.id).maybeSingle()).data?.file_path ?? null;
    const { error } = await supabase.from("branch_files").update(row).eq("id", input.id);
    if (error) return { error: await friendlyError(error.message) };
  } else {
    const { error } = await supabase.from("branch_files").insert(row);
    if (error) return { error: await friendlyError(error.message) };
  }
  if (oldPath) await supabase.storage.from("branch-files").remove([oldPath]);
  refreshAll();
  return {};
}

export async function deleteBranchFile(id: number): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("branch_files").select("file_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("branch_files").delete().eq("id", id);
  if (error) return { error: await friendlyError(error.message) };
  if (data?.file_path) await supabase.storage.from("branch-files").remove([data.file_path]);
  refreshAll();
  return {};
}

// ---------- equipment (admin and maintenance manager) ----------
async function requireEquipmentEditor() {
  const s = await requireActive();
  if (!["admin", "maintenance_manager"].includes(s.profile.role)) redirect("/");
  return s;
}

export async function saveEquipment(id: number | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireEquipmentEditor();
  const { t } = await getT();
  const cat = s(fd, "category_id");
  const row = {
    branch_id: Number(s(fd, "branch_id")), category_id: cat ? Number(cat) : null, name: s(fd, "name"),
    brand: opt(fd, "brand"), model: opt(fd, "model"), serial_no: opt(fd, "serial_no"), capacity: opt(fd, "capacity"),
    quantity: Math.max(1, Math.floor(Number(s(fd, "quantity")) || 1)),
    code: s(fd, "code").toUpperCase() || null,
    installed_on: opt(fd, "installed_on"), warranty_until: opt(fd, "warranty_until"), status: s(fd, "status") || "working", notes: opt(fd, "notes"),
    steam_type: (["dryer", "press", "other"].includes(s(fd, "steam_type")) ? s(fd, "steam_type") : null) as string | null,
    steam_kg_h: parseNum(s(fd, "steam_kg_h")), cycle_minutes: parseNum(s(fd, "cycle_minutes")),
  };
  if (!row.name) return { error: t.branchesTab.required };
  if (!row.steam_type) { row.steam_kg_h = null; row.cycle_minutes = null; }
  if (row.steam_type !== "dryer") row.cycle_minutes = null;
  if ((row.steam_kg_h !== null && row.steam_kg_h <= 0) || (row.cycle_minutes !== null && row.cycle_minutes <= 0)) return { error: t.branchesTab.equipment.steam.bad };
  if (row.steam_type === "other" && row.steam_kg_h === null) return { error: t.branchesTab.equipment.steam.needKg };
  const { error } = id
    ? await supabase.from("equipment").update(row).eq("id", id)
    : await supabase.from("equipment").insert(row);
  if (error) return { error: await friendlyError(error.message) };
  refreshAll();
  return { ok: t.branchesTab.equipment.saved };
}

export async function deleteEquipment(id: number): Promise<{ error?: string }> {
  const { supabase } = await requireEquipmentEditor();
  // a machine with tickets keeps its history: retire it instead of deleting it
  const { count } = await supabase.from("tickets").select("id", { count: "exact", head: true }).eq("equipment_id", id);
  if (count) return { error: (await getT()).t.branchesTab.equipment.hasTickets };
  const { count: counts } = await supabase.from("steam_counts").select("day", { count: "exact", head: true }).eq("equipment_id", id);
  if (counts) return { error: (await getT()).t.branchesTab.equipment.steam.hasCounts };
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) return { error: await friendlyError(error.message) };
  refreshAll();
  return {};
}
