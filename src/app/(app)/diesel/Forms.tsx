"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { removeUploaded, uploadFile } from "@/lib/upload";
import { fullCm, tankLiters, type Point, type Tank } from "@/lib/diesel";
import { FilePicker } from "@/components/FilePicker";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addRefuelFiles, recordCheck, recordRefuel } from "./actions";

type Opt = { id: number; name: string };
const fmt = (n: number | null) => (n === null || !Number.isFinite(n) ? "—" : new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n));

function BranchPicker({ branches, value, onChange }: { branches: Opt[]; value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <Field>
      <FieldLabel htmlFor="dz-branch">{t.diesel.branch} *</FieldLabel>
      <NativeSelect id="dz-branch" value={value} onChange={(e) => onChange(e.target.value)} required className="w-full">
        <NativeSelectOption value="" disabled>{t.diesel.chooseBranch}</NativeSelectOption>
        {branches.map((b) => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}
      </NativeSelect>
    </Field>
  );
}

function CmInput({ id, label, value, onChange, tank, points }: { id: string; label: string; value: string; onChange: (v: string) => void; tank: Tank; points: Point[] }) {
  const { t } = useI18n();
  const max = fullCm(tank);
  const l = value.trim() === "" ? null : tankLiters(tank, Number(value), points);
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="number" inputMode="decimal" min={0} max={max ?? undefined} step="0.1" value={value} onChange={(e) => onChange(e.target.value)} required />
      <span className="num text-[13px] font-semibold text-primary">{l === null ? (max ? t.diesel.form.maxCm(fmt(max)) : " ") : t.diesel.form.liters(fmt(l))}</span>
    </Field>
  );
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

export function RefuelForm({ branches, tanks, points, defaultBranch }: { branches: Opt[]; tanks: Tank[]; points: Point[]; defaultBranch?: number }) {
  const { t } = useI18n();
  const F = t.diesel.form;
  const router = useRouter();
  const [branch, setBranch] = useState(String(defaultBranch ?? (branches.length === 1 ? branches[0].id : "")));
  const mine = useMemo(() => tanks.filter((x) => String(x.branch_id) === branch && x.active), [tanks, branch]);
  const [read, setRead] = useState<Record<number, { b: string; a: string }>>({});
  const [ordered, setOrdered] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [total, setTotal] = useState("");
  const sumOf = (k: "b" | "a") => mine.reduce((s, tk) => s + (read[tk.id]?.[k] ? tankLiters(tk, Number(read[tk.id][k]), points) ?? 0 : 0), 0);
  const complete = mine.length > 0 && mine.every((tk) => read[tk.id]?.b && read[tk.id]?.a);
  const before = sumOf("b"), after = sumOf("a"), received = after - before;
  const diff = complete && ordered ? Math.round((received - Number(ordered)) * 10) / 10 : null;
  const perL = ordered && total && Number(ordered) > 0 ? Number(total) / Number(ordered) : null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    const res = await recordRefuel({
      branchId: Number(branch), date: String(fd.get("date") ?? ""), invoiceLiters: ordered, supplier: String(fd.get("supplier") ?? ""),
      total, invoice: String(fd.get("invoice") ?? ""), notes: String(fd.get("notes") ?? ""),
      dips: mine.map((tk) => ({ tank_id: tk.id, before_cm: read[tk.id]?.b ?? "", after_cm: read[tk.id]?.a ?? "" })),
    });
    if (res.error || !res.id) { setBusy(false); setError(res.error ?? ""); return; }
    // the delivery is saved; photos follow. If a photo fails, stay here and say so (nothing is lost).
    const uploaded: { path: string; type: string }[] = [];
    let photoError: string | null = null;
    for (const f of files) {
      const r = await uploadFile("diesel-files", branch, f, t.errors, 10);
      if ("error" in r) { photoError = r.error; break; }
      uploaded.push(r);
    }
    const reg = await addRefuelFiles(res.id, uploaded);
    if (reg.error) { for (const u of uploaded) await removeUploaded("diesel-files", u.path); photoError = reg.error; }
    setBusy(false);
    if (photoError) { setError(F.photoFailed(photoError)); return; }
    router.push(`/diesel?saved=${res.id}`);
  }

  return (
    <form method="post" onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <BranchPicker branches={branches} value={branch} onChange={(v) => { setBranch(v); setRead({}); }} />
      <Field><FieldLabel htmlFor="dz-date">{F.date} *</FieldLabel><Input id="dz-date" name="date" type="date" required defaultValue={today()} max={today()} /></Field>

      {branch && (
        <div className="flex flex-col gap-3 sm:col-span-2">
          <p className="text-sm text-ink-muted">{F.howTo}</p>
          {mine.length === 0 ? <p className="rounded-[14px] bg-warning-soft px-4 py-3 text-sm font-medium text-warning">{t.diesel.noTanks}</p> : mine.map((tk) => (
            <fieldset key={tk.id} className="grid grid-cols-2 gap-3 rounded-[14px] bg-canvas p-3.5">
              <legend className="sr-only">{tk.label}</legend>
              <p className="col-span-2 text-sm font-semibold">{tk.label} <span className="font-normal text-ink-muted">· {t.diesel.tanks.shapes[tk.shape]} · {fmt(tk.capacity_l)} L</span></p>
              <CmInput id={`b-${tk.id}`} label={F.before} tank={tk} points={points} value={read[tk.id]?.b ?? ""} onChange={(v) => setRead((r) => ({ ...r, [tk.id]: { b: v, a: r[tk.id]?.a ?? "" } }))} />
              <CmInput id={`a-${tk.id}`} label={F.after} tank={tk} points={points} value={read[tk.id]?.a ?? ""} onChange={(v) => setRead((r) => ({ ...r, [tk.id]: { b: r[tk.id]?.b ?? "", a: v } }))} />
            </fieldset>
          ))}
        </div>
      )}

      {complete && (
        <dl className="grid grid-cols-3 gap-2 rounded-[14px] bg-surface-tint p-3.5 text-center sm:col-span-2" aria-live="polite">
          <div><dt className="text-[12.5px] text-ink-muted">{F.beforeL}</dt><dd className="num m-0 text-[20px] font-semibold">{fmt(before)} L</dd></div>
          <div><dt className="text-[12.5px] text-ink-muted">{F.filledL}</dt><dd className="num m-0 text-[20px] font-semibold text-primary">+{fmt(received)} L</dd></div>
          <div><dt className="text-[12.5px] text-ink-muted">{F.afterL}</dt><dd className="num m-0 text-[20px] font-semibold">{fmt(after)} L</dd></div>
        </dl>
      )}
      <Field><FieldLabel htmlFor="dz-ord">{F.ordered} *</FieldLabel><Input id="dz-ord" type="number" inputMode="decimal" min={1} step="0.1" required value={ordered} onChange={(e) => setOrdered(e.target.value)} /></Field>
      <Field>
        <FieldLabel htmlFor="dz-total">{F.price}</FieldLabel>
        <Input id="dz-total" type="number" inputMode="decimal" min={0} step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} />
        {perL !== null && <span className="num text-[13px] font-semibold text-primary">{F.pricePerL(new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(perL))}</span>}
      </Field>
      {diff !== null && (
        <p className={cn("rounded-[14px] px-4 py-3 text-sm font-semibold sm:col-span-2", diff < 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success")} aria-live="polite">
          {F.difference}: {diff < 0 ? F.short(fmt(-diff)) : diff > 0 ? F.extra(fmt(diff)) : F.exact}
        </p>
      )}
      <Field><FieldLabel htmlFor="dz-sup">{F.supplier}</FieldLabel><Input id="dz-sup" name="supplier" dir="auto" /></Field>
      <Field><FieldLabel htmlFor="dz-inv">{F.invoice}</FieldLabel><Input id="dz-inv" name="invoice" dir="ltr" /></Field>
      <Field className="sm:col-span-2"><FieldLabel htmlFor="dz-notes">{F.notes}</FieldLabel><Textarea id="dz-notes" name="notes" rows={2} dir="auto" /></Field>
      <div className="flex flex-col gap-1.5 sm:col-span-2"><span className="text-sm font-medium">{F.photos}</span><FilePicker files={files} onChange={setFiles} /></div>
      {error && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><Button type="submit" size="lg" disabled={busy || !branch || mine.length === 0}>{busy && <Spinner data-icon="inline-start" />}{busy ? t.common.saving : F.save}</Button></div>
    </form>
  );
}

export function CheckForm({ branches, tanks, points, defaultBranch }: { branches: Opt[]; tanks: Tank[]; points: Point[]; defaultBranch?: number }) {
  const { t } = useI18n();
  const F = t.diesel.form;
  const router = useRouter();
  const [branch, setBranch] = useState(String(defaultBranch ?? (branches.length === 1 ? branches[0].id : "")));
  const mine = useMemo(() => tanks.filter((x) => String(x.branch_id) === branch && x.active), [tanks, branch]);
  const [cm, setCm] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = mine.reduce((s, tk) => s + (cm[tk.id] ? tankLiters(tk, Number(cm[tk.id]), points) ?? 0 : 0), 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    const r = await recordCheck({ branchId: Number(branch), notes: String(fd.get("notes") ?? ""), dips: mine.map((tk) => ({ tank_id: tk.id, cm: cm[tk.id] ?? "" })) });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    router.push("/diesel?saved=check");
  }

  return (
    <form method="post" onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><BranchPicker branches={branches} value={branch} onChange={(v) => { setBranch(v); setCm({}); }} /></div>
      {branch && (
        <div className="flex flex-col gap-3 sm:col-span-2">
          <p className="text-sm text-ink-muted">{F.checkHowTo}</p>
          {mine.length === 0 ? <p className="rounded-[14px] bg-warning-soft px-4 py-3 text-sm font-medium text-warning">{t.diesel.noTanks}</p> : mine.map((tk) => (
            <div key={tk.id} className="grid grid-cols-2 items-end gap-3 rounded-[14px] bg-canvas p-3.5">
              <p className="text-sm font-semibold">{tk.label} <span className="block font-normal text-ink-muted">{t.diesel.tanks.shapes[tk.shape]} · {fmt(tk.capacity_l)} L</span></p>
              <CmInput id={`c-${tk.id}`} label={F.level} tank={tk} points={points} value={cm[tk.id] ?? ""} onChange={(v) => setCm((c) => ({ ...c, [tk.id]: v }))} />
            </div>
          ))}
          {mine.length > 1 && <p className="num text-sm font-semibold">{t.diesel.table.stock}: {fmt(total)} L</p>}
        </div>
      )}
      <Field className="sm:col-span-2"><FieldLabel htmlFor="dc-notes">{F.notes}</FieldLabel><Textarea id="dc-notes" name="notes" rows={2} dir="auto" /></Field>
      {error && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><Button type="submit" size="lg" disabled={busy || !branch || mine.length === 0}>{busy && <Spinner data-icon="inline-start" />}{busy ? t.common.saving : F.saveCheck}</Button></div>
    </form>
  );
}
