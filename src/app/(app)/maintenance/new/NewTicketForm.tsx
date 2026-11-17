"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { uploadTicketFiles } from "@/lib/upload";
import { FilePicker } from "@/components/FilePicker";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createTicketAction } from "../actions";

type Opt = { id: number; name: string };
const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

type Machine = { id: number; branchId: number; name: string; categoryId: number | null };

export function NewTicketForm({ branches, categories, defaultBranch, machines, defaultEquipment }: {
  branches: Opt[]; categories: Opt[]; defaultBranch?: number; machines: Machine[]; defaultEquipment?: number;
}) {
  const { t } = useI18n();
  const M = t.maintenance;
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string>(String(defaultBranch ?? (branches.length === 1 ? branches[0].id : "")));
  const [machineId, setMachineId] = useState<string>(defaultEquipment ? String(defaultEquipment) : "");
  const [catId, setCatId] = useState<string>(() => String(machines.find((m) => m.id === defaultEquipment)?.categoryId ?? ""));
  const branchMachines = machines.filter((m) => String(m.branchId) === branchId);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setBusy(M.submitting);
    const res = await createTicketAction({
      branchId: Number(fd.get("branch_id")), categoryId: fd.get("category_id") ? Number(fd.get("category_id")) : null,
      priority: String(fd.get("priority")), title: String(fd.get("title") ?? ""), description: String(fd.get("description") ?? ""),
      stopsBranch: fd.get("stops_branch") === "on",
      equipmentId: machineId ? Number(machineId) : null,
    });
    if (res.error || !res.id) { setBusy(null); setError(res.error ?? t.errors.generic("")); return; }
    if (files.length) {
      setBusy(M.uploading);
      const upErr = await uploadTicketFiles(res.id, files, t.errors);
      if (upErr) { setBusy(null); setError(t.errors.ticketSavedUploadFailed(res.id, upErr)); return; }
    }
    router.push(`/maintenance/${res.id}`);
  }

  const chip = "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-input bg-surface px-4 text-sm transition-colors duration-150 has-[:checked]:border-primary has-[:checked]:bg-surface-tint";

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="nt-branch">{M.branch} *</FieldLabel>
        <NativeSelect id="nt-branch" name="branch_id" required value={branchId} onChange={(e) => { setBranchId(e.target.value); setMachineId(""); }} className="w-full">
          <NativeSelectOption value="" disabled>{t.worker.branchRequired}</NativeSelectOption>
          {branches.map((b) => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="nt-cat">{M.category}</FieldLabel>
        <NativeSelect id="nt-cat" name="category_id" value={catId} onChange={(e) => setCatId(e.target.value)} className="w-full">
          <NativeSelectOption value="">—</NativeSelectOption>
          {categories.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {branchMachines.length > 0 && (
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="nt-machine">{t.branchesTab.equipment.machine}</FieldLabel>
          <NativeSelect id="nt-machine" value={machineId} className="w-full"
            onChange={(e) => { setMachineId(e.target.value); const m = branchMachines.find((x) => String(x.id) === e.target.value); if (m?.categoryId) setCatId(String(m.categoryId)); }}>
            <NativeSelectOption value="">{t.branchesTab.equipment.machineNone}</NativeSelectOption>
            {branchMachines.map((m) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      )}
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="nt-title">{M.problem} *</FieldLabel>
        <Input id="nt-title" name="title" required maxLength={160} placeholder={M.problemPh} dir="auto" />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="nt-desc">{M.details}</FieldLabel>
        <Textarea id="nt-desc" name="description" rows={3} placeholder={M.detailsPh} dir="auto" />
      </Field>
      <FieldSet className="sm:col-span-2">
        <FieldLegend variant="label">{M.priorityLabel}</FieldLegend>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((k) => (
            <label key={k} className={chip}>
              <input type="radio" name="priority" value={k} defaultChecked={k === "normal"} className="accent-primary" />
              <b className="font-semibold">{M.priority[k]}</b><span className="text-[13px] text-ink-muted">{M.priorityHint[k]}</span>
            </label>
          ))}
        </div>
      </FieldSet>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] bg-danger-soft px-4 text-sm font-semibold text-danger sm:col-span-2">
        <input type="checkbox" name="stops_branch" className="size-4 accent-danger" />{M.stopsBranch}
      </label>
      <div className="sm:col-span-2"><FilePicker files={files} onChange={setFiles} /></div>
      {error && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={!!busy} size="lg">
          {busy && <Spinner data-icon="inline-start" />}{busy ?? M.submit}
        </Button>
      </div>
    </form>
  );
}
