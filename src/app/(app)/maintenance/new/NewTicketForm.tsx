"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRIORITY } from "@/lib/tickets";
import { uploadTicketFiles } from "@/lib/upload";
import { FilePicker } from "@/components/FilePicker";
import { Field } from "@/components/ui";
import { createTicketAction } from "../actions";

type Opt = { id: number; name: string };

export function NewTicketForm({ branches, categories, defaultBranch }: { branches: Opt[]; categories: Opt[]; defaultBranch?: number }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setBusy("جاري تسجيل البلاغ...");
    const res = await createTicketAction({
      branchId: Number(fd.get("branch_id")), categoryId: fd.get("category_id") ? Number(fd.get("category_id")) : null,
      priority: String(fd.get("priority")), title: String(fd.get("title") ?? ""), description: String(fd.get("description") ?? ""),
      stopsBranch: fd.get("stops_branch") === "on",
    });
    if (res.error || !res.id) { setBusy(null); setError(res.error ?? "حصل خطأ"); return; }
    if (files.length) {
      setBusy("جاري رفع الصور...");
      const upErr = await uploadTicketFiles(res.id, files);
      if (upErr) { setBusy(null); setError(`البلاغ اتسجل (#${res.id}) بس ${upErr}`); return; }
    }
    router.push(`/maintenance/${res.id}`);
  }

  return (
    <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2">
      <Field label="الفرع *">
        <select name="branch_id" required defaultValue={defaultBranch ?? (branches.length === 1 ? branches[0].id : "")} className="input">
          <option value="" disabled>اختار الفرع</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      <Field label="نوع المشكلة">
        <select name="category_id" defaultValue="" className="input">
          <option value="">—</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="المشكلة باختصار *" className="sm:col-span-2">
        <input name="title" required maxLength={160} className="input" placeholder="مثال: المكبس رقم 2 بيسرّب بخار" />
      </Field>
      <Field label="التفاصيل" className="sm:col-span-2">
        <textarea name="description" rows={3} className="input" placeholder="إيه اللي حصل، من إمتى، أي ملاحظات تساعد الفني" />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="label">الأولوية</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRIORITY).map(([k, v]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="radio" name="priority" value={k} defaultChecked={k === "normal"} />
              <b>{v.label}</b> <span className="text-xs text-slate-500">{v.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 sm:col-span-2">
        <input type="checkbox" name="stops_branch" /> المشكلة دي موقّفة الفرع عن الشغل
      </label>
      <div className="sm:col-span-2"><FilePicker files={files} onChange={setFiles} /></div>
      {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={!!busy}>{busy ?? "تسجيل البلاغ"}</button>
      </div>
    </form>
  );
}
