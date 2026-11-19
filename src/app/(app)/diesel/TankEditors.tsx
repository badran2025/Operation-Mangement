"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fullCm, geoLiters, type Dim, type Shape, type Tank } from "@/lib/diesel";
import { parseNum } from "@/lib/numbers";
import { ShapeFields, emptyDims, type DimValues } from "./ShapeFields";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { buildCalibration, deleteTank, saveCalibration, saveTank } from "./actions";

export function TankForm({ branchId, tank, onDone }: { branchId: number; tank?: Tank; onDone?: () => void }) {
  const { t } = useI18n();
  const T = t.diesel.tanks;
  const router = useRouter();
  const [busy, start] = useTransition();
  const [shape, setShape] = useState<Shape>(tank?.shape ?? "box");
  const [dims, setDims] = useState<DimValues>(emptyDims(tank ?? undefined));
  const p = tank ? `tk${tank.id}` : "tkn";
  const asNum = (d: Dim) => parseNum(dims[d]);
  const probe = { shape, length_cm: asNum("length_cm"), width_cm: asNum("width_cm"), height_cm: asNum("height_cm"), diameter_cm: asNum("diameter_cm") };
  const full = fullCm(probe);
  const cap = full === null ? null : geoLiters(probe, full);
  const fmt = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
  return (
    <ActionForm action={saveTank.bind(null, branchId, tank?.id ?? null)} className="grid gap-3 sm:grid-cols-3">
      <Field className="sm:col-span-3"><FieldLabel htmlFor={`${p}-label`}>{T.label}</FieldLabel><Input id={`${p}-label`} name="label" defaultValue={tank?.label ?? "Tank 1"} dir="auto" /></Field>
      <div className="sm:col-span-3">
        <ShapeFields prefix={p} shape={shape} onShape={setShape} dims={dims} onDims={setDims} named
          below={<p className="num rounded-xl bg-surface-tint px-3 py-2 text-sm font-semibold text-primary" aria-live="polite">{cap !== null && full !== null ? T.preview(fmt(cap), fmt(full)) : T.previewEmpty}</p>} />
      </div>
      <Field className="sm:col-span-3">
        <FieldLabel htmlFor={`${p}-eu`}>{T.entryUnit}</FieldLabel>
        <NativeSelect id={`${p}-eu`} name="entry_unit" defaultValue={tank?.entry_unit ?? (shape === "box" ? "liters" : "cm")} key={tank ? undefined : `eu-${shape}`} className="w-full">
          {["cm", "liters"].map((m) => <NativeSelectOption key={m} value={m}>{T.entryUnits[m]}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field className="sm:col-span-3">
        <FieldLabel htmlFor={`${p}-mb`}>{T.measureBy}</FieldLabel>
        <NativeSelect id={`${p}-mb`} name="measure_by" defaultValue={tank?.measure_by ?? "liters"} className="w-full">
          {["liters", "cm"].map((m) => <NativeSelectOption key={m} value={m}>{T.measure[m]}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field className="sm:col-span-3"><FieldLabel htmlFor={`${p}-notes`}>{T.notes}</FieldLabel><Input id={`${p}-notes`} name="notes" defaultValue={tank?.notes ?? ""} dir="auto" /></Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
        <label className="flex min-h-10 items-center gap-2 text-sm font-medium"><input type="checkbox" name="confirmed" defaultChecked={tank?.confirmed ?? false} className="size-4 accent-primary" />{T.confirmed}</label>
        {tank && <label className="flex min-h-10 items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={tank.active} className="size-4 accent-primary" />{T.inUse}</label>}
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-3">
        <SubmitButton>{tank ? t.common.save : T.add}</SubmitButton>
        {onDone && <Button type="button" variant="ghost" onClick={onDone}>{t.common.cancel}</Button>}
        {tank && (
          <Button type="button" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" disabled={busy}
            onClick={() => window.confirm(T.deleteConfirm) && start(async () => { const r = await deleteTank(tank.id); if (r.error || r.notice) window.alert(r.error ?? r.notice); router.refresh(); })}>
            <Trash2Icon data-icon="inline-start" />{t.common.delete}
          </Button>
        )}
      </div>
    </ActionForm>
  );
}

export function AddTank({ branchId }: { branchId: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}>{t.diesel.tanks.add}</Button>;
  return <div className="w-full rounded-2xl bg-canvas p-4"><TankForm branchId={branchId} onDone={() => setOpen(false)} /></div>;
}

export function CalibrationEditor({ tankId, points }: { tankId: number; points: { level_cm: number; liters: number }[] }) {
  const { t } = useI18n();
  const T = t.diesel.tanks;
  const router = useRouter();
  const initial = points.sort((a, b) => a.level_cm - b.level_cm).map((p) => `${p.level_cm} ${p.liters}`).join("\n");
  const [text, setText] = useState(initial);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{T.calibration}</span>
      <p className="text-[12.5px] text-ink-muted">{T.calibrationHint}</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} dir="ltr" className="num font-mono text-sm" placeholder={"0 0\n10 95\n20 260"} aria-label={T.calibration} />
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      {text !== initial && (
        <Button variant="outline" className="self-start" disabled={busy}
          onClick={() => start(async () => { setError(null); const r = await saveCalibration(tankId, text); if (r.error) setError(r.error); else router.refresh(); })}>
          {busy && <Spinner data-icon="inline-start" />}{T.saveCalibration}
        </Button>
      )}
    </div>
  );
}

export function BuildCalibration({ tankId }: { tankId: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" className="self-start" disabled={busy}
        onClick={() => start(async () => { const r = await buildCalibration(tankId); setMsg(r.error ? { error: r.error } : { ok: t.diesel.tanks.built(String(r.points)) }); if (!r.error) router.refresh(); })}>
        {busy && <Spinner data-icon="inline-start" />}{t.diesel.tanks.build}
      </Button>
      {msg?.error && <p role="alert" className="text-sm font-semibold text-danger">{msg.error}</p>}
      {msg?.ok && <p role="status" className="text-sm font-semibold text-success">✓ {msg.ok}</p>}
    </div>
  );
}
