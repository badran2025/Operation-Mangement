"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import type { Point, Tank } from "@/lib/diesel";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { recordReading } from "../actions";
import { startReading, TankReading, type Reading } from "../Forms";

export function ReadingForm({ branches, tanks, points, defaultBranch }: { branches: { id: number; name: string }[]; tanks: Tank[]; points: Point[]; defaultBranch?: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [branch, setBranch] = useState(String(defaultBranch ?? (branches.length === 1 ? branches[0].id : "")));
  const mine = useMemo(() => tanks.filter((x) => String(x.branch_id) === branch && x.active), [tanks, branch]);
  const [read, setRead] = useState<Record<number, Reading>>({});
  useEffect(() => { setRead(Object.fromEntries(mine.map((tk) => [tk.id, startReading(tk)]))); }, [mine]);
  const [notes, setNotes] = useState("");
  const nowParts = () => { const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); const g = (k: string) => f.find((x) => x.type === k)?.value ?? ""; return { d: `${g("year")}-${g("month")}-${g("day")}`, t: `${g("hour")}:${g("minute")}` }; };
  const [day, setDay] = useState(nowParts().d);
  const [time, setTime] = useState(nowParts().t);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const get = (tk: Tank) => read[tk.id] ?? startReading(tk);
  return (
    <form method="post" className="grid gap-4" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        setMsg(null);
        const r = await recordReading(Number(branch), mine.map((tk) => (get(tk).unit === "liters" ? { tank_id: tk.id, liters: get(tk).b } : { tank_id: tk.id, cm: get(tk).b })), notes, `${day}T${time || "08:00"}:00+03:00`);
        if (r.error) setMsg({ error: r.error }); else { setMsg({ ok: t.diesel.perf.readingSaved }); setRead(Object.fromEntries(mine.map((tk) => [tk.id, startReading(tk)]))); router.refresh(); }
      });
    }}>
      <Field>
        <FieldLabel htmlFor="rd-branch">{t.diesel.branch} *</FieldLabel>
        <NativeSelect id="rd-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full">
          <NativeSelectOption value="" disabled>{t.diesel.chooseBranch}</NativeSelectOption>
          {branches.map((b) => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field><FieldLabel htmlFor="rd-day">{t.diesel.perf.readingDate} *</FieldLabel><Input id="rd-day" type="date" required value={day} max={nowParts().d} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field><FieldLabel htmlFor="rd-time">{t.diesel.perf.readingTime}</FieldLabel><Input id="rd-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      {mine.map((tk) => <TankReading key={tk.id} tk={tk} points={points} value={get(tk)} single onChange={(r) => setRead((x) => ({ ...x, [tk.id]: r }))} />)}
      <Field><FieldLabel htmlFor="rd-notes">{t.diesel.form.notes}</FieldLabel><Input id="rd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" /></Field>
      {msg?.error && <p role="alert" className="m-0 text-sm font-semibold text-danger">{msg.error}</p>}
      {msg?.ok && <p role="status" className="m-0 text-sm font-semibold text-success">✓ {msg.ok}</p>}
      <Button type="submit" size="lg" className="self-start" disabled={busy || !branch || !mine.length}>{busy && <Spinner data-icon="inline-start" />}{busy ? t.common.saving : t.diesel.form.saveCheck}</Button>
    </form>
  );
}
