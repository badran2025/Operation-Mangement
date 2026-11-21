"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/** The period as one drop-down list; "from – to" opens two month boxes. */
export function PeriodPicker({ kind, from, to, now, base }: { kind: string; from: string; to: string; now: string; base: string }) {
  const { t } = useI18n();
  const P = t.diesel.period;
  const router = useRouter();
  const [range, setRange] = useState(kind === "range");
  const [a, setA] = useState(from), [z, setZ] = useState(to);
  const href = (q: string) => `${base}${base.includes("?") ? "&" : "?"}${q}`;
  const choose = (k: string) => {
    if (k === "range") { setRange(true); return; }
    setRange(false);
    router.push(href(k === "all" ? "p=all" : `p=${k}&m=${to}`));
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-ink-muted">{P.label}</span>
        <NativeSelect value={range ? "range" : kind} onChange={(e) => choose(e.target.value)} className="min-w-40" aria-label={P.label}>
          {(["1", "3", "6", "all", "range"] as const).map((k) => <NativeSelectOption key={k} value={k}>{P[{ "1": "one", "3": "three", "6": "six", all: "all", range: "range" }[k]]}</NativeSelectOption>)}
        </NativeSelect>
      </label>
      {range && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); router.push(href(`p=range&from=${a}&to=${z}`)); }}>
          <label className="flex flex-col gap-1 text-[12.5px] text-ink-muted">{P.from}<input type="month" value={a} max={now} onChange={(e) => setA(e.target.value)} className="h-9 rounded-lg border border-input bg-surface px-2 text-sm text-ink" /></label>
          <label className="flex flex-col gap-1 text-[12.5px] text-ink-muted">{P.to}<input type="month" value={z} max={now} onChange={(e) => setZ(e.target.value)} className="h-9 rounded-lg border border-input bg-surface px-2 text-sm text-ink" /></label>
          <Button type="submit" size="sm" disabled={!a || !z}>{P.show}</Button>
        </form>
      )}
    </div>
  );
}
