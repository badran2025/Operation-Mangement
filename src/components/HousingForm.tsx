"use client";
import { useActionState } from "react";
import type { Housing } from "@prisma/client";
import type { FormState } from "@/lib/actions";
import { SubmitButton } from "./SubmitButton";

export function HousingForm({
  action,
  housing,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  housing?: Housing;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="card grid gap-4 p-5">
      <div>
        <label className="label">اسم السكن *</label>
        <input name="name" required defaultValue={housing?.name} className="input" placeholder="مثال: سكن العزيزية - عمارة 3" />
      </div>
      <div>
        <label className="label">العنوان</label>
        <input name="address" defaultValue={housing?.address ?? ""} className="input" />
      </div>
      <div>
        <label className="label">ملاحظات</label>
        <textarea name="notes" rows={3} defaultValue={housing?.notes ?? ""} className="input" />
      </div>
      {state.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
      <div>
        <SubmitButton>حفظ</SubmitButton>
      </div>
    </form>
  );
}
