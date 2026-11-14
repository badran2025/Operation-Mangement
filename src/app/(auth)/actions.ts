"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/components/ActionForm";

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email") ?? "").trim(),
    password: String(fd.get("password") ?? ""),
  });
  if (error) return { error: "الإيميل أو كلمة المرور غلط" };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
