"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { removeUploaded, uploadFile } from "@/lib/upload";
import { parseNum } from "@/lib/numbers";
import { cmForLiters, fullCm, tankLiters, type Point, type Tank } from "@/lib/diesel";
import { FilePicker } from "@/components/FilePicker";
import { NumberInput } from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addRefuelFiles, recordRefuel, updateRefuel } from "./actions";
import { TankShape } from "./TankShape";

type Opt = { id: number; name: string };
type Unit = "cm" | "liters";
export type Reading = { unit: Unit; b: string; a: string };
export type RefuelInitial = { id: number; branchId: number; date: string; ordered: string; total: string; price: string; supplier: string; invoice: string; notes: string; readings: Record<number, Reading> };
const fmt = (n: number | null, d = 1) => (n === null || !Number.isFinite(n) ? "—" : new Intl.NumberFormat("en", { maximumFractionDigits: d }).format(n));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

/** litres and cm of one entered value, whichever unit it was typed in */
export function both(tk: Tank, unit: Unit, v: string, points: Point[]) {
  const n = parseNum(v);
  if (n === null) return { cm: null, liters: null };
  if (unit === "liters") return { liters: n, cm: cmForLiters(tk, n, points) };
  return { cm: n, liters: tk.liters_known ? tankLiters(tk, n, points) : null };
}

/** One tank: its picture (filling as you type), cm or litres, before and after. */
function TankReading({ tk, points, value, onChange, single = false }: { tk: Tank; points: Point[]; value: Reading; onChange: (r: Reading) => void; single?: boolean }) {
  const { t } = useI18n();
  const F = t.diesel.form;
  const full = fullCm(tk);
  const b = both(tk, value.unit, value.b, points), a = both(tk, value.unit, value.a, points);
  const level = (a.cm ?? b.cm);
  const unitName = value.unit === "cm" ? F.unitCm : F.unitL;
  const hint = (x: { cm: number | null; liters: number | null }, typed: string) => {
    if (parseNum(typed) === null) return value.unit === "cm" && full ? t.diesel.form.maxCm(fmt(full)) : tk.capacity_l ? `≤ ${fmt(tk.capacity_l)} L` : " ";
    if (value.unit === "cm") return x.liters === null ? " " : F.liters(fmt(x.liters));
    return x.cm === null ? t.diesel.errors.badReading : F.approxCm(fmt(x.cm));
  };
  return (
    <fieldset className="grid gap-3 rounded-[14px] bg-canvas p-3.5 sm:grid-cols-[9rem_1fr]">
      <legend className="sr-only">{tk.label}</legend>
      <div className="flex flex-col items-center gap-1">
        <TankShape shape={tk.shape} fill={level !== null && full ? level / full : 0} className="h-24 w-32" />
        <span className="text-center text-[12.5px] font-semibold">{tk.label}</span>
        <span className="text-center text-[12px] text-ink-muted">{t.diesel.tanks.shapes[tk.shape]}{tk.liters_known && tk.capacity_l ? ` · ${fmt(tk.capacity_l, 0)} L` : ""}</span>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-ink-muted">{F.unit}</span>
          <span className="inline-flex rounded-full bg-surface p-0.5" role="radiogroup" aria-label={`${tk.label}: ${F.unit}`}>
            {(["cm", "liters"] as const).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={value.unit === u} disabled={u === "liters" && !tk.liters_known}
                onClick={() => onChange({ unit: u, b: "", a: "" })}
                className={cn("h-8 rounded-full px-3 font-semibold transition-colors duration-150 disabled:opacity-40", value.unit === u ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink")}>
                {u === "cm" ? F.unitCm : F.unitL}
              </button>
            ))}
          </span>
        </div>
        {!tk.liters_known && <p className="m-0 text-[13px] text-warning">{F.cmTank}</p>}
        <div className={cn("grid gap-3", single ? "grid-cols-1" : "grid-cols-2")}>
          <Field>
            <FieldLabel htmlFor={`b-${tk.id}`}>{single ? `${t.diesel.form.level.split(" (")[0]} (${unitName})` : F.beforeIn(unitName)} *</FieldLabel>
            <NumberInput id={`b-${tk.id}`} required value={value.b} onChange={(e) => onChange({ ...value, b: e.target.value })} />
            <span className={cn("num text-[13px] font-semibold", parseNum(value.b) !== null && value.unit === "liters" && b.cm === null ? "text-danger" : "text-primary")}>{hint(b, value.b)}</span>
          </Field>
          {!single && (
            <Field>
              <FieldLabel htmlFor={`a-${tk.id}`}>{F.afterIn(unitName)} *</FieldLabel>
              <NumberInput id={`a-${tk.id}`} required value={value.a} onChange={(e) => onChange({ ...value, a: e.target.value })} />
              <span className={cn("num text-[13px] font-semibold", parseNum(value.a) !== null && value.unit === "liters" && a.cm === null ? "text-danger" : "text-primary")}>{hint(a, value.a)}</span>
            </Field>
          )}
        </div>
      </div>
    </fieldset>
  );
}
export { TankReading };

export const startReading = (tk: Tank): Reading => ({ unit: tk.liters_known && tk.entry_unit === "liters" ? "liters" : "cm", b: "", a: "" });
export const dipPayload = (tk: Tank, r: Reading | undefined) =>
  r?.unit === "liters" ? { tank_id: tk.id, before_l: r.b, after_l: r.a } : { tank_id: tk.id, before_cm: r?.b ?? "", after_cm: r?.a ?? "" };

export function RefuelForm({ branches, tanks, points, last, defaultBranch, initial }: {
  branches: Opt[]; tanks: Tank[]; points: Point[]; last: Record<number, { price: number | null; supplier: string | null }>; defaultBranch?: number; initial?: RefuelInitial;
}) {
  const { t } = useI18n();
  const F = t.diesel.form;
  const router = useRouter();
  const [branch, setBranch] = useState(String(initial?.branchId ?? defaultBranch ?? (branches.length === 1 ? branches[0].id : "")));
  const mine = useMemo(() => tanks.filter((x) => String(x.branch_id) === branch && x.active), [tanks, branch]);
  const [read, setRead] = useState<Record<number, Reading>>(initial?.readings ?? {});
  const [ordered, setOrdered] = useState(initial?.ordered ?? "");
  const [total, setTotal] = useState(initial?.total ?? "");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // a new delivery starts with each tank's usual unit and the branch's last price and supplier
  useEffect(() => {
    if (initial) return;
    setRead(Object.fromEntries(mine.map((tk) => [tk.id, startReading(tk)])));
    const l = last[Number(branch)];
    setPrice(l?.price ? String(l.price) : "");
    setSupplier((s) => s || l?.supplier || "");
  }, [branch, mine, last, initial]);
  useEffect(() => { if (initial?.price) setPrice(initial.price); }, [initial]);

  const get = (tk: Tank) => read[tk.id] ?? startReading(tk);
  const vals = mine.map((tk) => ({ tk, b: both(tk, get(tk).unit, get(tk).b, points), a: both(tk, get(tk).unit, get(tk).a, points) }));
  const complete = mine.length > 0 && mine.every((tk) => parseNum(get(tk).b) !== null && parseNum(get(tk).a) !== null);
  const allLitres = vals.every((v) => v.b.liters !== null && v.a.liters !== null);
  const before = vals.reduce((s, v) => s + (v.b.liters ?? 0), 0), after = vals.reduce((s, v) => s + (v.a.liters ?? 0), 0), received = after - before;
  const ord = parseNum(ordered), tot = parseNum(total), pr = parseNum(price);
  const effectiveTotal = tot !== null ? tot : pr !== null && ord ? Math.round(pr * ord * 100) / 100 : null;
  const diff = complete && allLitres && ord ? Math.round((received - ord) * 10) / 10 : null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    const payload = {
      branchId: Number(branch), date: String(fd.get("date") ?? ""), invoiceLiters: ordered, supplier,
      total: effectiveTotal === null ? "" : String(effectiveTotal), invoice: String(fd.get("invoice") ?? ""), notes: String(fd.get("notes") ?? ""),
      dips: mine.map((tk) => dipPayload(tk, get(tk))),
    };
    const res = initial ? await updateRefuel(initial.id, payload) : await recordRefuel(payload);
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
    router.push(initial ? `/diesel/${branch}?tab=tanks` : `/diesel?tab=tanks&saved=${res.id}`);
  }

  return (
    <form method="post" onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="dz-branch">{t.diesel.branch} *</FieldLabel>
        <NativeSelect id="dz-branch" value={branch} disabled={!!initial} onChange={(e) => { setBranch(e.target.value); }} required className="w-full">
          <NativeSelectOption value="" disabled>{t.diesel.chooseBranch}</NativeSelectOption>
          {branches.map((b) => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field><FieldLabel htmlFor="dz-date">{F.date} *</FieldLabel><Input id="dz-date" name="date" type="date" required defaultValue={initial?.date ?? today()} max={today()} /></Field>

      {branch && (
        <div className="flex flex-col gap-3 sm:col-span-2">
          <p className="m-0 text-sm text-ink-muted">{F.howToBoth}</p>
          {mine.length === 0 ? <p className="rounded-[14px] bg-warning-soft px-4 py-3 text-sm font-medium text-warning">{t.diesel.noTanks}</p>
            : mine.map((tk) => <TankReading key={tk.id} tk={tk} points={points} value={get(tk)} onChange={(r) => setRead((x) => ({ ...x, [tk.id]: r }))} />)}
        </div>
      )}

      {complete && allLitres && (
        <dl className="grid grid-cols-3 gap-2 rounded-[14px] bg-surface-tint p-3.5 text-center sm:col-span-2" aria-live="polite">
          <div><dt className="text-[12.5px] text-ink-muted">{F.beforeL}</dt><dd className="num m-0 text-[20px] font-semibold">{fmt(before)} L</dd></div>
          <div><dt className="text-[12.5px] text-ink-muted">{F.filledL}</dt><dd className="num m-0 text-[20px] font-semibold text-primary">+{fmt(received)} L</dd></div>
          <div><dt className="text-[12.5px] text-ink-muted">{F.afterL}</dt><dd className="num m-0 text-[20px] font-semibold">{fmt(after)} L</dd></div>
        </dl>
      )}
      <Field><FieldLabel htmlFor="dz-ord">{F.ordered} *</FieldLabel><NumberInput id="dz-ord" required value={ordered} onChange={(e) => setOrdered(e.target.value)} /></Field>
      <Field>
        <FieldLabel htmlFor="dz-price">{F.perLiter}</FieldLabel>
        <NumberInput id="dz-price" value={price} onChange={(e) => setPrice(e.target.value)} disabled={tot !== null} />
        <span className="num text-[13px] font-semibold text-primary">
          {tot === null && effectiveTotal !== null ? F.totalCalc(fmt(effectiveTotal, 2)) : tot !== null && ord ? F.priceCalc(fmt(tot / ord, 3)) : last[Number(branch)]?.price && !initial ? F.perLiterHint : " "}
        </span>
      </Field>
      {diff !== null && (
        <p className={cn("rounded-[14px] px-4 py-3 text-sm font-semibold sm:col-span-2", diff < 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success")} aria-live="polite">
          {F.difference}: {diff < 0 ? F.short(fmt(-diff)) : diff > 0 ? F.extra(fmt(diff)) : F.exact}
        </p>
      )}
      <Field className="sm:col-span-2"><FieldLabel htmlFor="dz-total">{F.totalIfWritten}</FieldLabel><NumberInput id="dz-total" value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
      <Field><FieldLabel htmlFor="dz-sup">{F.supplier}</FieldLabel><Input id="dz-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} dir="auto" /></Field>
      <Field><FieldLabel htmlFor="dz-inv">{F.invoice}</FieldLabel><Input id="dz-inv" name="invoice" dir="ltr" defaultValue={initial?.invoice ?? ""} /></Field>
      <Field className="sm:col-span-2"><FieldLabel htmlFor="dz-notes">{F.notes}</FieldLabel><Textarea id="dz-notes" name="notes" rows={2} dir="auto" defaultValue={initial?.notes ?? ""} /></Field>
      <div className="flex flex-col gap-1.5 sm:col-span-2"><span className="text-sm font-medium">{F.photos}</span><FilePicker files={files} onChange={setFiles} /></div>
      {error && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><Button type="submit" size="lg" disabled={busy || !branch || mine.length === 0}>{busy && <Spinner data-icon="inline-start" />}{busy ? t.common.saving : initial ? F.saveEdit : F.save}</Button></div>
    </form>
  );
}
