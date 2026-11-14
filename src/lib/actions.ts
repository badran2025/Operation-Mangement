"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function optional(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type FormState = { error?: string };

/* ---------------- الفروع ---------------- */

function branchData(fd: FormData) {
  return {
    name: str(fd, "name"),
    address: optional(fd, "address"),
    supervisor: optional(fd, "supervisor"),
    phone: optional(fd, "phone"),
    notes: optional(fd, "notes"),
  };
}

export async function createBranch(_: FormState, fd: FormData): Promise<FormState> {
  const data = branchData(fd);
  if (!data.name) return { error: "اسم الفرع مطلوب" };
  const branch = await db.branch.create({ data });
  revalidatePath("/");
  redirect(`/branches/${branch.id}`);
}

export async function updateBranch(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const data = branchData(fd);
  if (!data.name) return { error: "اسم الفرع مطلوب" };
  await db.branch.update({ where: { id }, data });
  revalidatePath("/");
  revalidatePath(`/branches/${id}`);
  redirect(`/branches/${id}`);
}

export async function deleteBranch(id: number) {
  await db.branch.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}

/* ---------------- السكن ---------------- */

function housingData(fd: FormData) {
  return {
    name: str(fd, "name"),
    address: optional(fd, "address"),
    notes: optional(fd, "notes"),
  };
}

export async function createHousing(_: FormState, fd: FormData): Promise<FormState> {
  const data = housingData(fd);
  if (!data.name) return { error: "اسم السكن مطلوب" };
  await db.housing.create({ data });
  revalidatePath("/housing");
  redirect("/housing");
}

export async function updateHousing(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const data = housingData(fd);
  if (!data.name) return { error: "اسم السكن مطلوب" };
  await db.housing.update({ where: { id }, data });
  revalidatePath("/housing");
  redirect("/housing");
}

export async function deleteHousing(id: number) {
  await db.housing.delete({ where: { id } });
  revalidatePath("/housing");
  revalidatePath("/");
  redirect("/housing");
}

/* ---------------- العمال ---------------- */

function workerData(fd: FormData) {
  const housingRaw = str(fd, "housingId");
  const daysOff = fd
    .getAll("daysOff")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return {
    name: str(fd, "name"),
    code: optional(fd, "code"),
    phone: optional(fd, "phone"),
    jobTitle: optional(fd, "jobTitle"),
    shiftStart: str(fd, "shiftStart"),
    shiftEnd: str(fd, "shiftEnd"),
    daysOff: [...new Set(daysOff)].join(","),
    notes: optional(fd, "notes"),
    branchId: Number(str(fd, "branchId")),
    housingId: housingRaw ? Number(housingRaw) : null,
  };
}

function validateWorker(d: ReturnType<typeof workerData>): string | undefined {
  if (!d.name) return "اسم العامل مطلوب";
  if (!Number.isInteger(d.branchId) || d.branchId <= 0) return "اختار الفرع";
  if (!TIME_RE.test(d.shiftStart) || !TIME_RE.test(d.shiftEnd)) return "مواعيد الدوام لازم تكون مكتملة";
}

export async function createWorker(_: FormState, fd: FormData): Promise<FormState> {
  const data = workerData(fd);
  const error = validateWorker(data);
  if (error) return { error };
  await db.worker.create({ data });
  revalidatePath("/");
  revalidatePath("/housing");
  redirect(`/branches/${data.branchId}`);
}

export async function updateWorker(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const data = workerData(fd);
  const error = validateWorker(data);
  if (error) return { error };
  const before = await db.worker.findUnique({ where: { id }, select: { branchId: true } });
  await db.worker.update({ where: { id }, data });
  revalidatePath("/");
  revalidatePath("/housing");
  if (before) revalidatePath(`/branches/${before.branchId}`);
  redirect(`/branches/${data.branchId}`);
}

export async function deleteWorker(id: number) {
  const w = await db.worker.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/housing");
  redirect(`/branches/${w.branchId}`);
}
