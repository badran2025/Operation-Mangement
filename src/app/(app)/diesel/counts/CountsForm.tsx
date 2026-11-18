"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n/format";
import { NumberInput } from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { saveSteamCounts } from "../actions";
import type { SteamMachineRow } from "../load";

type Count = { equipment_id: number; day: string; units: number };

export function CountsForm({ branches, branchId, day, today, machines, counts, start }: {
  branches: { id: number; name: string }[]; branchId: number | null; day: string; today: string; machines: SteamMachineRow[]; counts: Count[]; start: string;
}) {
  const { t, locale } = useI18n();
  const S = t.diesel.steam;
  const router = useRouter();
  const go = (b: number | null, d: string) => router.push(`/diesel/counts?${b ? `branch=${b}&` : ""}date=${d}`);
  const initial = Object.fromEntries(machines.map((m) => [m.id, String(counts.find((c) => c.equipment_id === m.id && c.day === day)?.units ?? "")]));
  const [vals, setVals] = useState<Record<number, string>>(initial);
  const [busy, start_] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
  const changed = machines.some((m) => (vals[m.id] ?? "") !== (initial[m.id] ?? ""));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="sc-branch">{t.diesel.branch} *</FieldLabel>
          <NativeSelect id="sc-branch" value={branchId ?? ""} onChange={(e) => go(Number(e.target.value) || null, day)} className="w-full">
            <NativeSelectOption value="" disabled>{t.diesel.chooseBranch}</NativeSelectOption>
            {branches.map((b) => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="sc-day">{S.day} *</FieldLabel>
          <Input id="sc-day" type="date" value={day} max={today} onChange={(e) => e.target.value && go(branchId, e.target.value)} />
        </Field>
      </div>
      {branches.length === 0 && <p className="rounded-[14px] bg-warning-soft px-4 py-3 text-sm font-medium text-warning">{S.noMachinesAnywhere}</p>}
      {branchId && machines.length === 0 && <p className="rounded-[14px] bg-warning-soft px-4 py-3 text-sm font-medium text-warning">{S.noMachines}</p>}

      {branchId && machines.length > 0 && (
        <form method="post" className="flex flex-col gap-3" onSubmit={(e) => {
          e.preventDefault();
          start_(async () => {
            setMsg(null);
            const r = await saveSteamCounts(branchId, day, machines.map((m) => ({ equipment_id: m.id, units: vals[m.id] ?? "" })));
            if (r.error) setMsg({ error: r.error }); else { setMsg({ ok: S.savedDay(formatDate(locale, day)) }); router.refresh(); }
          });
        }}>
          <p className="text-sm text-ink-muted">{S.howTo}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {machines.map((m) => (
              <label key={m.id} htmlFor={`sc-${m.id}`} className="flex items-center gap-3 rounded-[14px] bg-canvas p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" dir="auto"><span className="num text-ink-muted" dir="ltr">{m.code}</span> · {m.name}</span>
                  <span className="block text-[12.5px] text-ink-muted">{S.unitLabel[m.steam_type]}</span>
                </span>
                <NumberInput id={`sc-${m.id}`} className="w-28" value={vals[m.id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [m.id]: e.target.value }))} placeholder="0" />
              </label>
            ))}
          </div>
          {msg?.error && <p role="alert" className="text-sm font-semibold text-danger">{msg.error}</p>}
          {msg?.ok && <p role="status" className="text-sm font-semibold text-success">✓ {msg.ok}</p>}
          <Button type="submit" size="lg" className="self-start" disabled={busy || !changed}>{busy && <Spinner data-icon="inline-start" />}{busy ? t.common.saving : S.save}</Button>
        </form>
      )}

      {branchId && machines.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{S.last14}</h2>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead>
                <tr className="text-ink-muted">
                  <th className="h-8 pe-2 text-start font-semibold">{S.machine}</th>
                  {days.map((d) => (
                    <th key={d} className="px-0.5 text-center font-medium">
                      <button type="button" onClick={() => go(branchId, d)} className={cn("num w-full rounded-md px-1 py-0.5 hover:bg-surface-tint", d === day && "bg-primary text-primary-foreground hover:bg-primary")}>{d.slice(8)}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id} className="border-t border-hairline">
                    <td className="py-1.5 pe-2"><span className="num font-medium" dir="ltr">{m.code}</span></td>
                    {days.map((d) => {
                      const c = counts.find((x) => x.equipment_id === m.id && x.day === d);
                      return <td key={d} className={cn("num px-0.5 text-center", c ? "font-semibold" : "text-danger/70")}>{c ? new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(c.units) : "·"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-ink-muted">{S.dotMeans}</p>
        </section>
      )}
    </div>
  );
}
