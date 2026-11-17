"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaperclipIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { removeUploaded, uploadFile } from "@/lib/upload";
import { EQUIPMENT_STATUSES } from "@/lib/branch";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteBranchFile, deleteEquipment, saveBranchFile, saveEquipment, updateBranchInfo } from "../actions";

type Opt = { id: number; name: string };
type Hour = { weekday: number; open_time: string | null; close_time: string | null; is_24h: boolean; is_closed: boolean };
const hhmm = (v: string | null) => (v ? (v.startsWith("24:") ? "00:00" : v.slice(0, 5)) : "");

// ---------- branch info + opening hours ----------
export function InfoEditor({ branch, hours, startOpen }: {
  branch: { id: number; name_ar: string; name_en: string; code: string | null; status: string; phone: string | null; address: string | null; map_url: string | null;
    hours_note: string | null; ppm_weekday: number | null; ppm_time: string | null; notes: string | null };
  hours: Hour[]; startOpen?: boolean;
}) {
  const { t } = useI18n();
  const B = t.branchesTab;
  const I = B.info;
  const [open, setOpen] = useState(Boolean(startOpen));
  const init = Array.from({ length: 7 }, (_, d) => {
    const h = hours.find((x) => x.weekday === d);
    return { mode: !h ? "" : h.is_24h ? "24h" : h.is_closed ? "closed" : "open", open: hhmm(h?.open_time ?? null), close: hhmm(h?.close_time ?? null) };
  });
  const [rows, setRows] = useState(init);
  const set = (d: number, patch: Partial<(typeof init)[number]>) => setRows((r) => r.map((x, i) => (i === d ? { ...x, ...patch } : x)));

  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}><PencilIcon data-icon="inline-start" />{I.edit}</Button>;
  return (
    <ActionForm action={updateBranchInfo.bind(null, branch.id)} className="grid gap-4 sm:grid-cols-2">
      <Field><FieldLabel htmlFor="bi-ar">{B.nameAr}</FieldLabel><Input id="bi-ar" name="name_ar" defaultValue={branch.name_ar} required dir="rtl" /></Field>
      <Field><FieldLabel htmlFor="bi-en">{B.nameEn}</FieldLabel><Input id="bi-en" name="name_en" defaultValue={branch.name_en} required dir="ltr" /></Field>
      <Field>
        <FieldLabel htmlFor="bi-code">{I.code}</FieldLabel>
        <Input id="bi-code" name="code" defaultValue={branch.code ?? ""} dir="ltr" className="uppercase" maxLength={5} autoCapitalize="characters" />
        <p className="text-[12.5px] text-ink-muted">{I.codeHint}</p>
      </Field>
      <Field>
        <FieldLabel htmlFor="bi-st">{I.statusLabel}</FieldLabel>
        <NativeSelect id="bi-st" name="status" defaultValue={branch.status} className="w-full">
          {["active", "stopped", "closed"].map((s) => <NativeSelectOption key={s} value={s}>{B.status[s]}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field><FieldLabel htmlFor="bi-ph">{I.phone}</FieldLabel><Input id="bi-ph" name="phone" type="tel" defaultValue={branch.phone ?? ""} dir="ltr" /></Field>
      <Field><FieldLabel htmlFor="bi-ad">{I.address}</FieldLabel><Input id="bi-ad" name="address" defaultValue={branch.address ?? ""} dir="auto" /></Field>
      <Field><FieldLabel htmlFor="bi-map">{I.map}</FieldLabel><Input id="bi-map" name="map_url" type="url" defaultValue={branch.map_url ?? ""} dir="ltr" placeholder="https://maps.google.com/…" /></Field>

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">{I.hours}</legend>
        {rows.map((r, d) => (
          <div key={d} className="grid grid-cols-[88px_1fr] items-center gap-2 sm:grid-cols-[110px_160px_1fr]">
            <span className="text-sm font-medium">{t.weekdays[d]}</span>
            <NativeSelect name={`mode_${d}`} value={r.mode} onChange={(e) => set(d, { mode: e.target.value })} aria-label={t.weekdays[d]} className="w-full">
              <NativeSelectOption value="">—</NativeSelectOption>
              <NativeSelectOption value="open">{I.open}</NativeSelectOption>
              <NativeSelectOption value="24h">{I.h24}</NativeSelectOption>
              <NativeSelectOption value="closed">{I.closedDay}</NativeSelectOption>
            </NativeSelect>
            {r.mode === "open" ? (
              <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <Input type="time" name={`open_${d}`} value={r.open} onChange={(e) => set(d, { open: e.target.value })} aria-label={`${t.weekdays[d]} ${I.from}`} className="w-32" />
                <span className="text-ink-muted">–</span>
                <Input type="time" name={`close_${d}`} value={r.close} onChange={(e) => set(d, { close: e.target.value })} aria-label={`${t.weekdays[d]} ${I.to}`} className="w-32" />
              </div>
            ) : <span className="hidden sm:block" />}
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setRows((r) => r.map(() => ({ ...r[0] })))}>{I.sameEveryDay}</Button>
        <p className="text-[13px] text-ink-muted">{t.worker.midnightHint}</p>
      </fieldset>

      <Field className="sm:col-span-2"><FieldLabel htmlFor="bi-hn">{I.hoursNote}</FieldLabel><Input id="bi-hn" name="hours_note" defaultValue={branch.hours_note ?? ""} dir="auto" /></Field>
      <Field>
        <FieldLabel htmlFor="bi-ppm">{I.ppmDay}</FieldLabel>
        <NativeSelect id="bi-ppm" name="ppm_weekday" defaultValue={branch.ppm_weekday ?? ""} className="w-full">
          <NativeSelectOption value="">{I.none}</NativeSelectOption>
          {t.weekdays.map((w, i) => <NativeSelectOption key={i} value={i}>{w}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field><FieldLabel htmlFor="bi-pt">{I.ppmTime}</FieldLabel><Input id="bi-pt" name="ppm_time" type="time" defaultValue={hhmm(branch.ppm_time)} /></Field>
      <Field className="sm:col-span-2"><FieldLabel htmlFor="bi-n">{I.notes}</FieldLabel><Textarea id="bi-n" name="notes" rows={2} defaultValue={branch.notes ?? ""} dir="auto" /></Field>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>{I.save}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
      </div>
    </ActionForm>
  );
}

// ---------- branch file record (+ optional scan) ----------
export function FileEditor({ branchId, kinds, file, defaultKind }: {
  branchId: number; kinds: string[];
  file?: { id: number; kind: string; title: string; number: string | null; expiry_date: string | null; notes: string | null; file_path: string | null };
  defaultKind?: string;
}) {
  const { t } = useI18n();
  const F = t.branchesTab.files;
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState(file?.kind ?? defaultKind ?? kinds[0]);
  const [upload, setUpload] = useState<File | null>(null);
  const fixedKind = Boolean(defaultKind) && !file;
  const idp = file ? `f${file.id}` : `fn-${defaultKind ?? "new"}`;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      setError(null);
      let path: string | null = null, mime: string | null = null;
      if (upload) {
        const r = await uploadFile("branch-files", branchId, upload, t.errors);
        if ("error" in r) { setError(r.error); return; }
        path = r.path; mime = r.type;
      }
      const res = await saveBranchFile({
        branchId, id: file?.id ?? null, kind, title: String(fd.get("title") ?? ""), number: String(fd.get("number") ?? ""),
        expiry: String(fd.get("expiry") ?? ""), notes: String(fd.get("notes") ?? ""), filePath: path, mime,
      });
      if (res.error) { await removeUploaded("branch-files", path); setError(res.error); return; }
      setUpload(null);
      router.refresh();
    });
  }

  return (
    <form method="post" onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      {!fixedKind && (
        <Field>
          <FieldLabel htmlFor={`${idp}-k`}>{F.kind}</FieldLabel>
          <NativeSelect id={`${idp}-k`} value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">
            {kinds.map((k) => <NativeSelectOption key={k} value={k}>{F.kinds[k]}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      )}
      {(kind === "other" || kind === "snag_list" || kind === "technical_report") && (
        <Field><FieldLabel htmlFor={`${idp}-t`}>{F.titleLabel}</FieldLabel><Input id={`${idp}-t`} name="title" defaultValue={file?.title ?? ""} dir="auto" /></Field>
      )}
      <Field><FieldLabel htmlFor={`${idp}-n`}>{F.number}</FieldLabel><Input id={`${idp}-n`} name="number" defaultValue={file?.number ?? ""} dir="ltr" /></Field>
      <Field><FieldLabel htmlFor={`${idp}-e`}>{F.expiry}</FieldLabel><Input id={`${idp}-e`} name="expiry" type="date" defaultValue={file?.expiry_date ?? ""} /></Field>
      <Field className="sm:col-span-2"><FieldLabel htmlFor={`${idp}-no`}>{F.notes}</FieldLabel><Input id={`${idp}-no`} name="notes" defaultValue={file?.notes ?? ""} dir="auto" /></Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{F.file}</span>
        <label className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-full border border-input bg-surface px-4 text-sm font-medium hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
          <PaperclipIcon className="size-4" aria-hidden />
          <span className="max-w-[160px] truncate" dir="auto">{upload ? upload.name : file?.file_path ? t.common.edit : F.file}</span>
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setUpload(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-3">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-3">
        <Button type="submit" disabled={busy}>{busy && <Spinner data-icon="inline-start" />}{busy ? t.common.saving : file ? t.common.save : F.record}</Button>
        {file && (
          <Button type="button" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" disabled={busy}
            onClick={() => window.confirm(F.deleteConfirm) && start(async () => { const r = await deleteBranchFile(file.id); if (r.error) setError(r.error); else router.refresh(); })}>
            <Trash2Icon data-icon="inline-start" />{t.common.delete}
          </Button>
        )}
      </div>
    </form>
  );
}

// ---------- equipment ----------
export type EquipmentRow = {
  id: number; branch_id: number; category_id: number | null; name: string; brand: string | null; model: string | null; serial_no: string | null;
  capacity: string | null; installed_on: string | null; warranty_until: string | null; status: string; notes: string | null; quantity: number; code: string;
};

export function EquipmentEditor({ item, branchId, branches, categories, onDone }: {
  item?: EquipmentRow; branchId: number; branches: Opt[]; categories: Opt[]; onDone?: () => void;
}) {
  const { t } = useI18n();
  const E = t.branchesTab.equipment;
  const router = useRouter();
  const [busy, start] = useTransition();
  const p = item ? `e${item.id}` : "en";
  return (
    <ActionForm action={saveEquipment.bind(null, item?.id ?? null)} className="grid gap-3 sm:grid-cols-3">
      <Field><FieldLabel htmlFor={`${p}-code`}>{E.code}</FieldLabel><Input id={`${p}-code`} name="code" defaultValue={item?.code ?? ""} placeholder={E.codePh} dir="ltr" className="uppercase" autoCapitalize="characters" /></Field>
      <Field><FieldLabel htmlFor={`${p}-name`}>{E.name} *</FieldLabel><Input id={`${p}-name`} name="name" required defaultValue={item?.name ?? ""} placeholder={E.namePh} dir="auto" /></Field>
      <Field>
        <FieldLabel htmlFor={`${p}-cat`}>{E.category}</FieldLabel>
        <NativeSelect id={`${p}-cat`} name="category_id" defaultValue={item?.category_id ?? ""} className="w-full">
          <NativeSelectOption value="">—</NativeSelectOption>
          {categories.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${p}-st`}>{E.status}</FieldLabel>
        <NativeSelect id={`${p}-st`} name="status" defaultValue={item?.status ?? "working"} className="w-full">
          {EQUIPMENT_STATUSES.map((s) => <NativeSelectOption key={s} value={s}>{E.statuses[s]}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field><FieldLabel htmlFor={`${p}-br`}>{E.brand}</FieldLabel><Input id={`${p}-br`} name="brand" defaultValue={item?.brand ?? ""} dir="auto" /></Field>
      <Field><FieldLabel htmlFor={`${p}-mo`}>{E.model}</FieldLabel><Input id={`${p}-mo`} name="model" defaultValue={item?.model ?? ""} dir="auto" /></Field>
      <Field><FieldLabel htmlFor={`${p}-sn`}>{E.serial}</FieldLabel><Input id={`${p}-sn`} name="serial_no" defaultValue={item?.serial_no ?? ""} dir="ltr" /></Field>
      <Field><FieldLabel htmlFor={`${p}-q`}>{E.quantity}</FieldLabel><Input id={`${p}-q`} name="quantity" type="number" min={1} step={1} inputMode="numeric" defaultValue={item?.quantity ?? 1} /></Field>
      <Field><FieldLabel htmlFor={`${p}-cap`}>{E.capacity}</FieldLabel><Input id={`${p}-cap`} name="capacity" defaultValue={item?.capacity ?? ""} dir="auto" /></Field>
      <Field><FieldLabel htmlFor={`${p}-in`}>{E.installed}</FieldLabel><Input id={`${p}-in`} name="installed_on" type="date" defaultValue={item?.installed_on ?? ""} /></Field>
      <Field><FieldLabel htmlFor={`${p}-wa`}>{E.warranty}</FieldLabel><Input id={`${p}-wa`} name="warranty_until" type="date" defaultValue={item?.warranty_until ?? ""} /></Field>
      <Field>
        <FieldLabel htmlFor={`${p}-b`}>{E.branch}</FieldLabel>
        <NativeSelect id={`${p}-b`} name="branch_id" defaultValue={item?.branch_id ?? branchId} className="w-full">
          {branches.map((b) => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field className="sm:col-span-2"><FieldLabel htmlFor={`${p}-no`}>{E.notes}</FieldLabel><Input id={`${p}-no`} name="notes" defaultValue={item?.notes ?? ""} dir="auto" /></Field>
      <div className="flex flex-wrap gap-2 sm:col-span-3">
        <SubmitButton>{item ? t.common.save : E.add}</SubmitButton>
        {onDone && <Button type="button" variant="ghost" onClick={onDone}>{t.common.cancel}</Button>}
        {item && (
          <Button type="button" variant="ghost" className={cn("text-danger hover:bg-danger-soft hover:text-danger")} disabled={busy}
            onClick={() => window.confirm(E.deleteConfirm) && start(async () => { const r = await deleteEquipment(item.id); if (r.error) window.alert(r.error); else router.refresh(); })}>
            <Trash2Icon data-icon="inline-start" />{t.common.delete}
          </Button>
        )}
      </div>
    </ActionForm>
  );
}

/** "Add a machine" button that opens the form in place. */
export function AddEquipment(props: { branchId: number; branches: Opt[]; categories: Opt[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}>{t.branchesTab.equipment.add}</Button>;
  return <div className="w-full rounded-2xl bg-canvas p-4"><EquipmentEditor {...props} onDone={() => setOpen(false)} /></div>;
}
