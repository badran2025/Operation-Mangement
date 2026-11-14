"use server";
import { revalidatePath } from "next/cache";
import { requireActive } from "@/lib/auth";
import type { ActionState } from "@/components/ActionForm";
import { friendlyError } from "@/lib/server-errors";
import { getT } from "@/lib/i18n/server";


function refresh(id?: number) {
  revalidatePath("/maintenance");
  revalidatePath("/");
  if (id) revalidatePath(`/maintenance/${id}`);
}

export async function createTicketAction(input: {
  branchId: number; categoryId: number | null; priority: string; title: string; description: string; stopsBranch: boolean;
}): Promise<{ id?: number; error?: string }> {
  const { supabase } = await requireActive();
  if (!input.branchId) return { error: (await getT()).t.worker.branchRequired };
  if (!input.title.trim()) return { error: (await getT()).t.errors.titleRequired };
  const { data, error } = await supabase.rpc("create_ticket", {
    p_branch_id: input.branchId, p_category_id: input.categoryId as number, p_priority: input.priority,
    p_title: input.title, p_description: input.description, p_stops_branch: input.stopsBranch,
  });
  if (error) return { error: await friendlyError(error.message) };
  refresh();
  return { id: data as number };
}

export async function addCommentAction(ticketId: number, body: string, kind: "comment" | "parts" = "comment"): Promise<{ eventId?: number; error?: string }> {
  const { supabase } = await requireActive();
  const { data, error } = await supabase.rpc("add_ticket_comment", { p_ticket_id: ticketId, p_body: body, p_kind: kind });
  if (error) return { error: await friendlyError(error.message) };
  return { eventId: data as number };
}

export async function refreshTicket(ticketId: number) {
  refresh(ticketId);
}

export async function setStatusAction(ticketId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireActive();
  const { error } = await supabase.rpc("set_ticket_status", {
    p_ticket_id: ticketId, p_status: String(fd.get("status")), p_note: String(fd.get("note") ?? ""),
  });
  if (error) return { error: await friendlyError(error.message) };
  refresh(ticketId);
  return { ok: (await getT()).t.common.saved };
}

/** Triage in one step: who fixes it + how urgent it is. */
export async function assignAction(ticketId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireActive();
  const { t } = await getT();
  const who = String(fd.get("assigned_to") ?? "");
  const isExternal = who === "external";
  const name = String(fd.get("assignee_name") ?? "").trim();
  const priority = String(fd.get("priority") ?? "");
  const hadTech = fd.get("had_tech") === "1";
  if (isExternal && !name) return { error: t.maintenance.flow.nameRequired };
  if (!who && !hadTech && priority === String(fd.get("current_priority") ?? "")) return { error: t.maintenance.flow.chooseTech };

  if (priority && priority !== String(fd.get("current_priority") ?? "")) {
    const { error } = await supabase.rpc("set_ticket_priority", { p_ticket_id: ticketId, p_priority: priority });
    if (error) return { error: await friendlyError(error.message) };
  }
  if (who || hadTech) {
    const { error } = await supabase.rpc("assign_ticket", {
      p_ticket_id: ticketId,
      p_assigned_to: (isExternal || !who ? null : who) as string,
      p_assignee_name: isExternal ? name : undefined,
      p_assignee_phone: isExternal ? String(fd.get("assignee_phone") ?? "") : undefined,
    });
    if (error) return { error: await friendlyError(error.message) };
  }
  refresh(ticketId);
  return { ok: t.common.saved };
}

export async function priorityAction(ticketId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireActive();
  const { error } = await supabase.rpc("set_ticket_priority", { p_ticket_id: ticketId, p_priority: String(fd.get("priority")) });
  if (error) return { error: await friendlyError(error.message) };
  refresh(ticketId);
  return { ok: (await getT()).t.common.saved };
}

export async function reminderAction(ticketId: number): Promise<{ error?: string }> {
  const { supabase } = await requireActive();
  const { error } = await supabase.rpc("log_ticket_reminder", { p_ticket_id: ticketId, p_channel: "whatsapp" });
  if (error) return { error: await friendlyError(error.message) };
  refresh(ticketId);
  return {};
}
