"use client";
import { useActionState } from "react";
import type { Branch } from "@prisma/client";
import type { FormState } from "@/lib/actions";
import { SubmitButton } from "./SubmitButton";

export function BranchForm({
  action,
  branch,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  branch?: Branch;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="card grid gap-4 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">اسم الفرع *</label>
        <input name="name" required defaultValue={branch?.name} className="input" />
      </div>
      <div>
        <label className="label">مشرف الفرع</label>
        <input name="supervisor" defaultValue={branch?.supervisor ?? ""} className="input" />
      </div>
      <div>
        <label className="label">رقم التواصل</label>
        <input name="phone" dir="ltr" defaultValue={branch?.phone ?? ""} className="input text-right" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">العنوان / الموقع</label>
        <input name="address" defaultValue={branch?.address ?? ""} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">ملاحظات</label>
        <textarea name="notes" rows={3} defaultValue={branch?.notes ?? ""} className="input" />
      </div>
      {state.error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <SubmitButton>حفظ</SubmitButton>
      </div>
    </form>
  );
}
