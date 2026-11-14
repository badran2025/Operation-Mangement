"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/components/ActionForm";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => s(fd, k) || null;
const num = (fd: FormData, k: string) => (s(fd, k) ? Number(s(fd, k)) : null);
const TIME = /^([01]\d|2[0-4]):[0-5]\d$/;

function infoFrom(fd: FormData) {
  return {
    full_name: s(fd, "full_name"),
    alt_name: opt(fd, "alt_name"),
    emp_no: opt(fd, "emp_no"),
    nationality: opt(fd, "nationality"),
    gender: opt(fd, "gender"),
    phone: opt(fd, "phone"),
    email: opt(fd, "email"),
    birth_date: opt(fd, "birth_date"),
    blood_type: opt(fd, "blood_type"),
    emergency_contact: opt(fd, "emergency_contact"),
    joined_at: opt(fd, "joined_at"),
    status: s(fd, "status") || "active",
    housing_id: num(fd, "housing_id"),
    shoe_size: opt(fd, "shoe_size"),
    uniform_size: opt(fd, "uniform_size"),
    notes: opt(fd, "notes"),
  };
}

function scheduleFrom(fd: FormData) {
  const starts = fd.getAll("shift_start").map(String);
  const ends = fd.getAll("shift_end").map(String);
  const shifts = starts
    .map((st, i) => ({ start: st, end: ends[i] === "00:00" ? "24:00" : (ends[i] ?? "") }))
    .filter((x) => x.start || x.end);
  const bad = shifts.find((x) => !TIME.test(x.start) || !TIME.test(x.end));
  const days = fd.getAll("days_off").map(Number).filter((n) => n >= 0 && n <= 6);
  return { shifts, days, noDayOff: fd.get("no_day_off") === "on", breakTime: opt(fd, "break_time"), bad };
}

function friendly(msg: string) {
  if (msg.includes("workers_emp_no_key")) return "الرقم الوظيفي ده مستخدم لعامل تاني";
  return "حصل خطأ: " + msg;
}

export async function updateWorkerInfo(id: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const data = infoFrom(fd);
  if (!data.full_name) return { error: "الاسم مطلوب" };
  const { error } = await supabase.from("workers").update(data).eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/workers/${id}`);
  return { ok: "اتحفظت البيانات ✓" };
}

export async function saveSchedule(id: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const sch = scheduleFrom(fd);
  if (sch.bad) return { error: "مواعيد الدوام لازم تكون مكتملة (البداية والنهاية)" };
  const { error } = await supabase.rpc("save_worker_schedule", {
    p_worker_id: id, p_shifts: sch.shifts, p_days_off: sch.days, p_no_day_off: sch.noDayOff,
    p_break_time: sch.breakTime,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/workers/${id}`);
  return { ok: "اتحفظ الدوام ✓" };
}

export async function transferWorker(id: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const branchId = num(fd, "branch_id");
  if (!branchId) return { error: "اختار الفرع" };
  const { error } = await supabase.rpc("transfer_worker", {
    p_worker_id: id, p_branch_id: branchId, p_job_title_id: num(fd, "job_title_id") as number,
    p_start_date: opt(fd, "start_date") ?? undefined, p_note: opt(fd, "note") ?? undefined,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/workers/${id}`);
  revalidatePath("/");
  return { ok: "اتسجل النقل / تغيير الوظيفة ✓" };
}

export async function saveDocument(workerId: number, docType: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("worker_documents").upsert(
    { worker_id: workerId, doc_type: docType, number: opt(fd, "number"), issuer: opt(fd, "issuer"),
      expiry_date: opt(fd, "expiry_date"), notes: opt(fd, "notes") },
    { onConflict: "worker_id,doc_type" },
  );
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/workers/${workerId}`);
  revalidatePath("/documents");
  return { ok: "اتحفظ ✓" };
}

export async function createWorker(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const data = infoFrom(fd);
  const branchId = num(fd, "branch_id");
  if (!data.full_name) return { error: "الاسم مطلوب" };
  if (!branchId) return { error: "اختار الفرع" };
  const sch = scheduleFrom(fd);
  if (sch.bad) return { error: "مواعيد الدوام لازم تكون مكتملة (البداية والنهاية)" };

  const { data: w, error } = await supabase.from("workers").insert(data).select("id").single();
  if (error) return { error: friendly(error.message) };
  const r1 = await supabase.rpc("transfer_worker", {
    p_worker_id: w.id, p_branch_id: branchId, p_job_title_id: num(fd, "job_title_id") as number,
    p_start_date: opt(fd, "start_date") ?? undefined, p_note: "تعيين",
  });
  const r2 = await supabase.rpc("save_worker_schedule", {
    p_worker_id: w.id, p_shifts: sch.shifts, p_days_off: sch.days, p_no_day_off: sch.noDayOff,
    p_break_time: sch.breakTime,
  });
  if (r1.error || r2.error) return { error: friendly((r1.error ?? r2.error)!.message) };
  revalidatePath("/");
  redirect(`/workers/${w.id}`);
}
