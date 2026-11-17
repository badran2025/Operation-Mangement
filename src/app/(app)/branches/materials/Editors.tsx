"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Trash2Icon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { removeUploaded, uploadFile } from "@/lib/upload";
import { MATERIAL_CATEGORIES } from "@/lib/branch";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { deleteMaterial, saveMaterial, saveText } from "./actions";

export type MaterialRow = {
  id: number; name: string; category: string; unit: string | null; odoo_ref: string | null; min_qty: number | null; max_qty: number | null;
  photo_path: string | null; notes: string | null; active: boolean;
};

export function MaterialEditor({ item, photoUrl, onDone }: { item?: MaterialRow; photoUrl?: string | null; onDone?: () => void }) {
  const { t } = useI18n();
  const M = t.branchesTab.materials;
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const p = item ? `m${item.id}` : "mn";
  const preview = photo ? URL.createObjectURL(photo) : removePhoto ? null : photoUrl ?? null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    start(async () => {
      setError(null);
      let photoPath: string | null = null;
      if (photo) {
        const r = await uploadFile("material-photos", "items", photo, t.errors, 5);
        if ("error" in r) { setError(r.error); return; }
        photoPath = r.path;
      }
      const res = await saveMaterial({
        id: item?.id ?? null, name: String(fd.get("name") ?? ""), category: String(fd.get("category") ?? "other"), unit: String(fd.get("unit") ?? ""),
        odooRef: String(fd.get("odoo_ref") ?? ""), min: String(fd.get("min_qty") ?? ""), max: String(fd.get("max_qty") ?? ""),
        notes: String(fd.get("notes") ?? ""), active: fd.get("active") === "on", photoPath, removePhoto,
      });
      if (res.error) { await removeUploaded("material-photos", photoPath); setError(res.error); return; }
      setPhoto(null); setRemovePhoto(false);
      if (!item) { form.reset(); onDone?.(); }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[96px_1fr_1fr_1fr]">
      <div className="row-span-3 flex flex-col items-start gap-2 sm:items-center">
        {preview
          // eslint-disable-next-line @next/next/no-img-element -- local preview / storage URL
          ? <img src={preview} alt="" width={96} height={96} className="size-24 rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
          : <span className="flex size-24 items-center justify-center rounded-xl bg-surface-sunken text-ink-muted"><ImageIcon className="size-6" aria-hidden /></span>}
        <label className="cursor-pointer text-[13px] font-medium text-primary hover:underline">
          {M.photo}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); setRemovePhoto(false); }} />
        </label>
        {(photo || (photoUrl && !removePhoto)) && (
          <button type="button" className="text-[13px] text-danger hover:underline" onClick={() => { setPhoto(null); setRemovePhoto(Boolean(photoUrl)); }}>{M.removePhoto}</button>
        )}
      </div>
      <Field className="sm:col-span-2"><FieldLabel htmlFor={`${p}-n`}>{M.name} *</FieldLabel><Input id={`${p}-n`} name="name" required defaultValue={item?.name ?? ""} dir="auto" /></Field>
      <Field>
        <FieldLabel htmlFor={`${p}-c`}>{M.category}</FieldLabel>
        <NativeSelect id={`${p}-c`} name="category" defaultValue={item?.category ?? "chemicals"} className="w-full">
          {MATERIAL_CATEGORIES.map((c) => <NativeSelectOption key={c} value={c}>{M.categories[c]}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field><FieldLabel htmlFor={`${p}-u`}>{M.unit}</FieldLabel><Input id={`${p}-u`} name="unit" defaultValue={item?.unit ?? ""} placeholder={M.unitPh} dir="auto" /></Field>
      <Field><FieldLabel htmlFor={`${p}-mi`}>{M.min}</FieldLabel><Input id={`${p}-mi`} name="min_qty" type="number" min={0} step="any" inputMode="decimal" defaultValue={item?.min_qty ?? ""} /></Field>
      <Field><FieldLabel htmlFor={`${p}-ma`}>{M.max}</FieldLabel><Input id={`${p}-ma`} name="max_qty" type="number" min={0} step="any" inputMode="decimal" defaultValue={item?.max_qty ?? ""} /></Field>
      <Field><FieldLabel htmlFor={`${p}-o`}>{M.odoo}</FieldLabel><Input id={`${p}-o`} name="odoo_ref" defaultValue={item?.odoo_ref ?? ""} dir="ltr" /></Field>
      <Field className="sm:col-span-2"><FieldLabel htmlFor={`${p}-no`}>{M.notes}</FieldLabel><Input id={`${p}-no`} name="notes" defaultValue={item?.notes ?? ""} dir="auto" /></Field>
      <label className="flex min-h-10 items-center gap-2 self-end text-sm font-medium">
        <input type="checkbox" name="active" defaultChecked={item?.active ?? true} className="size-4 accent-primary" />{M.inUse}
      </label>
      {error && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-4">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-4">
        <Button type="submit" disabled={busy}>{busy && <Spinner data-icon="inline-start" />}{busy ? t.common.saving : item ? t.common.save : M.add}</Button>
        {onDone && <Button type="button" variant="ghost" onClick={onDone}>{t.common.cancel}</Button>}
        {item && (
          <Button type="button" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" disabled={busy}
            onClick={() => window.confirm(M.deleteConfirm) && start(async () => { const r = await deleteMaterial(item.id); if (r.error) setError(r.error); else router.refresh(); })}>
            <Trash2Icon data-icon="inline-start" />{t.common.delete}
          </Button>
        )}
      </div>
    </form>
  );
}

export function AddMaterial() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}>{t.branchesTab.materials.add}</Button>;
  return <div className="w-full rounded-2xl bg-canvas p-4"><MaterialEditor onDone={() => setOpen(false)} /></div>;
}

export function TextEditor({ textKey, value, placeholder, label }: { textKey: string; value: string; placeholder: string; label: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={placeholder} aria-label={label} dir="auto" />
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      {text !== value && (
        <Button variant="outline" className="self-start" disabled={busy}
          onClick={() => start(async () => { setError(null); const r = await saveText(textKey, text); if (r.error) setError(r.error); else router.refresh(); })}>
          {busy && <Spinner data-icon="inline-start" />}{t.common.save}
        </Button>
      )}
    </div>
  );
}
