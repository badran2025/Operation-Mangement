"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { parseNum } from "@/lib/numbers";
import { fullCm, tankLiters, type Point, type Tank } from "@/lib/diesel";
import { NumberInput } from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { recordReading } from "../actions";

const fmt = (n: number | null) => (n === null ? "—" : new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n));

export function ReadingForm({ branches, tanks, points, defaultBranch }: { branches: { id: number; name: string }[]; tanks: Tank[]; points: Point[]; defaultBranch?: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [branch, setBranch] = useState(String(defaultBranch ?? (branches.length === 1 ? branches[0].id : "")));
  const mine = useMemo(() => tanks.filter((x) => String(x.branch_id) === branch && x.active), [tanks, branch]);
  const [cm, setCm] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  return (
    <form method="post" className="grid gap-4" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        setMsg(null);
        const r = await recordReading(Number(branch), mine.map((tk) => ({ tank_id: tk.id, cm: cm[tk.id] ?? "" })), notes);
        if (r.error) setMsg({ error: r.error }); else { setMsg({ ok: t.diesel.perf.readingSaved }); setCm({}); router.refresh(); }
      });
    }}>
      <Field>
        <FieldLabel htmlFor="rd-branch">{t.diesel.branch} *</FieldLabel>
        <NativeSelect id="rd-branch" value={branch} onChange={(e) => { setBranch(e.target.value); setCm({}); }} className="w-full">
          <NativeSelectOption value="" disabled>{t.diesel.chooseBranch}</NativeSelectOption>
          {branches.map((b) => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {mine.map((tk) => {
        const v = parseNum(cm[tk.id] ?? "");
        return (
          <Field key={tk.id}>
            <FieldLabel htmlFor={`rd-${tk.id}`}>{tk.label} · {t.diesel.tanks.shapes[tk.shape]} (cm) *</FieldLabel>
            <NumberInput id={`rd-${tk.id}`} required value={cm[tk.id] ?? ""} onChange={(e) => setCm((c) => ({ ...c, [tk.id]: e.target.value }))} />
            <span className="num text-[13px] font-semibold text-primary">{v === null ? t.diesel.form.maxCm(fmt(fullCm(tk))) : t.diesel.form.liters(fmt(tankLiters(tk, v, points)))}</span>
          </Field>
        );
      })}
      <Field><FieldLabel htmlFor="rd-notes">{t.diesel.form.notes}</FieldLabel><Input id="rd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" /></Field>
      {msg?.error && <p role="alert" className="m-0 text-sm font-semibold text-danger">{msg.error}</p>}
      {msg?.ok && <p role="status" className="m-0 text-sm font-semibold text-success">✓ {msg.ok}</p>}
      <Button type="submit" size="lg" className="self-start" disabled={busy || !branch || !mine.length}>{busy && <Spinner data-icon="inline-start" />}{busy ? t.common.saving : t.diesel.form.saveCheck}</Button>
    </form>
  );
}
