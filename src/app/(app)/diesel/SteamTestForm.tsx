"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConicalIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { parseNum } from "@/lib/numbers";
import { NumberInput } from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { addSteamTest } from "./actions";

/** Record a condensate test: kg of water collected from the steam trap in N minutes → real kg/h. */
export function SteamTestForm({ branchId, machines, today }: { branchId: number; machines: { id: number; label: string }[]; today: string }) {
  const { t } = useI18n();
  const C = t.diesel.steam.check;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [machine, setMachine] = useState(String(machines[0]?.id ?? ""));
  const [day, setDay] = useState(today);
  const [minutes, setMinutes] = useState("10");
  const [kg, setKg] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const mi = parseNum(minutes), k = parseNum(kg);
  const rate = mi && k && mi > 0 ? (k * 60) / mi : null;

  if (!open) return <Button variant="outline" className="self-start" onClick={() => setOpen(true)}><FlaskConicalIcon data-icon="inline-start" />{C.addTest}</Button>;
  return (
    <form method="post" className="grid gap-3 rounded-[14px] border border-hairline bg-surface p-3.5 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        setMsg(null);
        const r = await addSteamTest({ branchId, equipmentId: Number(machine), day, minutes, kg, notes });
        if (r.error) setMsg({ error: r.error });
        else { setMsg({ ok: C.testSaved }); setKg(""); setNotes(""); router.refresh(); }
      });
    }}>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <p className="m-0 text-sm font-semibold">{C.howTitle}</p>
        <ol className="m-0 flex list-decimal flex-col gap-0.5 ps-5 text-[13px] text-ink-muted">{C.howTest.map((l) => <li key={l}>{l}</li>)}</ol>
      </div>
      <Field>
        <FieldLabel htmlFor="stt-m">{C.machine} *</FieldLabel>
        <NativeSelect id="stt-m" value={machine} onChange={(e) => setMachine(e.target.value)} className="w-full">
          {machines.map((m) => <NativeSelectOption key={m.id} value={m.id}>{m.label}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field><FieldLabel htmlFor="stt-d">{C.date} *</FieldLabel><Input id="stt-d" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} required /></Field>
      <Field><FieldLabel htmlFor="stt-min">{C.minutes} *</FieldLabel><NumberInput id="stt-min" value={minutes} onChange={(e) => setMinutes(e.target.value)} required /></Field>
      <Field><FieldLabel htmlFor="stt-kg">{C.kg} *</FieldLabel><NumberInput id="stt-kg" value={kg} onChange={(e) => setKg(e.target.value)} required /></Field>
      <p className="num m-0 rounded-xl bg-surface-tint px-3 py-2 text-sm font-semibold text-primary sm:col-span-2" aria-live="polite">
        {rate !== null ? C.result(new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(rate)) : C.resultEmpty}
      </p>
      <Field className="sm:col-span-2"><FieldLabel htmlFor="stt-n">{t.diesel.form.notes}</FieldLabel><Input id="stt-n" value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" /></Field>
      {msg?.error && <p role="alert" className="m-0 text-sm font-semibold text-danger sm:col-span-2">{msg.error}</p>}
      {msg?.ok && <p role="status" className="m-0 text-sm font-semibold text-success sm:col-span-2">✓ {msg.ok}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy || rate === null}>{busy && <Spinner data-icon="inline-start" />}{C.saveTest}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
      </div>
    </form>
  );
}
