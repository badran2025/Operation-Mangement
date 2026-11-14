"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, type Role } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/components/ActionForm";
import { getT } from "@/lib/i18n/server";
import { friendlyError } from "@/lib/server-errors";

const ROLES: Role[] = ["admin", "supervisor", "maintenance_manager", "technician"];

export async function updateUser(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const role = String(fd.get("role")) as Role;
  if (!ROLES.includes(role)) return { error: (await getT()).t.errors.notAllowed };
  const { error } = await supabase.rpc("admin_update_user", {
    p_user: userId, p_role: role, p_active: fd.get("active") === "on",
    p_branch_ids: fd.getAll("branch_ids").map(Number),
  });
  if (error) return { error: await friendlyError(error.message) };
  revalidatePath("/users");
  return { ok: (await getT()).t.common.saved };
}

export async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { error: (await getT()).t.users.needsKey };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const full_name = String(fd.get("full_name") ?? "").trim();
  if (password.length < 8) return { error: (await getT()).t.users.shortPw };
  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name },
  });
  if (error) return { error: error.message.includes("already") ? (await getT()).t.users.exists : await friendlyError(error.message) };
  revalidatePath("/users");
  return { ok: (await getT()).t.users.created(email) };
}

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: (await getT()).t.users.shortPw };
  if (password !== String(fd.get("confirm") ?? "")) return { error: (await getT()).t.account.mismatch };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: await friendlyError(error.message) };
  return { ok: (await getT()).t.account.changed };
}
