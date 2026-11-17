"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { friendlyError } from "@/lib/server-errors";

type Res = { error?: string; id?: number };
const done = (): Res => { revalidatePath("/plan"); return {}; };
const clean = (s: string | null | undefined) => (s ?? "").trim();

/** Only links inside the site or https links. */
function safeLink(v: string): string | null {
  const s = clean(v);
  if (!s) return null;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try { return new URL(s).protocol === "https:" ? s : null; } catch { return null; }
}

export async function createNode(parentId: number, title: string): Promise<Res> {
  const { supabase } = await requireAdmin();
  if (!clean(title)) return {};
  const { data: last } = await supabase.from("plan_nodes").select("sort").eq("parent_id", parentId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from("plan_nodes").insert({ parent_id: parentId, title: clean(title), sort: (last?.sort ?? -1) + 1 }).select("id").single();
  if (error) return { error: await friendlyError(error.message) };
  revalidatePath("/plan");
  return { id: data.id };
}

export async function updateNode(id: number, patch: { title?: string; status?: string; notes?: string; link?: string; parent_id?: number }): Promise<Res> {
  const { supabase } = await requireAdmin();
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) { if (!clean(patch.title)) return {}; row.title = clean(patch.title); }
  if (patch.status !== undefined) { if (!["todo", "doing", "done"].includes(patch.status)) return {}; row.status = patch.status; }
  if (patch.notes !== undefined) row.notes = clean(patch.notes) || null;
  if (patch.link !== undefined) row.link = safeLink(patch.link);
  if (patch.parent_id !== undefined) row.parent_id = patch.parent_id;
  const { error } = await supabase.from("plan_nodes").update(row).eq("id", id);
  if (error) return { error: await friendlyError(error.message) };
  return done();
}

export async function deleteNode(id: number): Promise<Res> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("plan_nodes").delete().eq("id", id).not("parent_id", "is", null);
  if (error) return { error: await friendlyError(error.message) };
  return done();
}

export async function addItem(nodeId: number, body: string): Promise<Res> {
  const { supabase } = await requireAdmin();
  if (!clean(body)) return {};
  const { data: last } = await supabase.from("plan_items").select("sort").eq("node_id", nodeId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("plan_items").insert({ node_id: nodeId, body: clean(body), sort: (last?.sort ?? -1) + 1 });
  if (error) return { error: await friendlyError(error.message) };
  return done();
}

export async function setItemDone(id: number, isDone: boolean): Promise<Res> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("plan_items").update({ done: isDone }).eq("id", id);
  if (error) return { error: await friendlyError(error.message) };
  return done();
}

export async function deleteItem(id: number): Promise<Res> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("plan_items").delete().eq("id", id);
  if (error) return { error: await friendlyError(error.message) };
  return done();
}
