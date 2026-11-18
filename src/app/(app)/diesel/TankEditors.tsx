"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { SHAPES, type Tank } from "@/lib/diesel";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { deleteTank, saveCalibration, saveTank } from "./actions";

export function TankForm({ branchId, tank, onDone }: { branchId: number; tank?: Tank; onDone?: () => void }) {
  const { t } = useI18n();
  const T = t.diesel.tanks;
  const router = useRouter();
  const [busy, start] = useTransition();
  const [shape, setShape] = useState<string>(tank?.shape ?? "box");
  const p = tank ? `tk${tank.id}` : "tkn";
  const dim = (name: "length_cm" | "width_cm" | "height_cm" | "diameter_cm", label: string) => (
    <Field><FieldLabel htmlFor={`${p}-${name}`}>{label} *</FieldLabel>
      <Input id={`${p}-${name}`} name={name} type="number" inputMode="decimal" min={1} step="0.1" required defaultValue={tank?.[name] ?? ""} /></Field>
  );
  return (
    <ActionForm action={saveTank.bind(null, branchId, tank?.id ?? null)} className="grid gap-3 sm:grid-cols-3">
      <Field><FieldLabel htmlFor={`${p}-label`}>{T.label}</FieldLabel><Input id={`${p}-label`} name="label" defaultValue={tank?.label ?? "Tank 1"} dir="auto" /></Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`${p}-shape`}>{T.shape}</FieldLabel>
        <NativeSelect id={`${p}-shape`} name="shape" value={shape} onChange={(e) => setShape(e.target.value)} className="w-full">
          {SHAPES.map((s) => <NativeSelectOption key={s} value={s}>{T.shapes[s]}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {shape === "box" && <>{dim("length_cm", T.length)}{dim("width_cm", T.width)}{dim("height_cm", T.height)}</>}
      {shape === "vertical_cylinder" && <>{dim("diameter_cm", T.diameter)}{dim("height_cm", T.height)}</>}
      {shape === "horizontal_cylinder" && <>{dim("diameter_cm", T.diameter)}{dim("length_cm", T.length)}</>}
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
