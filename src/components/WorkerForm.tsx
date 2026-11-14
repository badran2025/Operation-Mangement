"use client";
import { useActionState } from "react";
import type { Worker } from "@prisma/client";
import type { FormState } from "@/lib/actions";
import { DAYS, parseDaysOff } from "@/lib/days";
import { SubmitButton } from "./SubmitButton";

type Option = { id: number; name: string };

export function WorkerForm({
  action,
  worker,
  branches,
  housings,
  defaultBranchId,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  worker?: Worker;
  branches: Option[];
  housings: Option[];
  defaultBranchId?: number;
}) {
  const [state, formAction] = useActionState(action, {});
  const off = new Set(parseDaysOff(worker?.daysOff ?? ""));
  return (
    <form action={formAction} className="card grid gap-4 p-5 sm:grid-cols-2">
      <div>
        <label className="label">اسم العامل *</label>
        <input name="name" required defaultValue={worker?.name} className="input" />
      </div>
      <div>
        <label className="label">الرقم الوظيفي</label>
        <input name="code" defaultValue={worker?.code ?? ""} className="input" />
      </div>
      <div>
        <label className="label">الوظيفة</label>
        <input name="jobTitle" defaultValue={worker?.jobTitle ?? ""} className="input" placeholder="عامل نظافة، مشرف..." />
      </div>
      <div>
        <label className="label">رقم الجوال</label>
        <input name="phone" dir="ltr" defaultValue={worker?.phone ?? ""} className="input text-right" />
      </div>
      <div>
        <label className="label">الفرع *</label>
        <select name="branchId" required defaultValue={worker?.branchId ?? defaultBranchId ?? ""} className="input">
          <option value="" disabled>اختار الفرع</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">السكن</label>
        <select name="housingId" defaultValue={worker?.housingId ?? ""} className="input">
          <option value="">بدون سكن / غير محدد</option>
          {housings.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">بداية الدوام *</label>
        <input type="time" name="shiftStart" required defaultValue={worker?.shiftStart ?? "08:00"} className="input" />
      </div>
      <div>
        <label className="label">نهاية الدوام *</label>
        <input type="time" name="shiftEnd" required defaultValue={worker?.shiftEnd ?? "16:00"} className="input" />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label">الإجازة الأسبوعية</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <label
              key={d.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
            >
              <input type="checkbox" name="daysOff" value={d.value} defaultChecked={off.has(d.value)} className="accent-brand-600" />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label className="label">ملاحظات</label>
        <textarea name="notes" rows={2} defaultValue={worker?.notes ?? ""} className="input" />
      </div>
      {state.error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <SubmitButton>حفظ</SubmitButton>
      </div>
    </form>
  );
}
