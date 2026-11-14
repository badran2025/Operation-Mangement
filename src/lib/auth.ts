import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "admin" | "supervisor" | "maintenance_manager" | "technician";
export type Profile = { id: string; full_name: string; email: string | null; role: Role; active: boolean };

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير التشغيل (أدمن)",
  supervisor: "مشرف فرع",
  maintenance_manager: "مدير الصيانة",
  technician: "فني صيانة",
};

/** Current user + profile (cached per request). */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active")
    .eq("id", data.user.id)
    .single();
  return { supabase, user: data.user, profile: (profile as Profile | null) ?? null };
});

export async function requireActive() {
  const s = await getSession();
  if (!s.user) redirect("/login");
  if (!s.profile?.active) redirect("/pending");
  return { ...s, user: s.user, profile: s.profile };
}

export async function requireAdmin() {
  const s = await requireActive();
  if (s.profile.role !== "admin") redirect("/");
  return s;
}
