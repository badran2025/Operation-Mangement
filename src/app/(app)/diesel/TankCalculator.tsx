"use client";
import { useState } from "react";
import { CalculatorIcon, ChevronDownIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fullCm, geoLiters, type Dim, type Shape, type Tank } from "@/lib/diesel";
import { parseNum } from "@/lib/numbers";
import { NumberInput } from "@/components/NumberInput";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ShapeFields, emptyDims, type DimValues } from "./ShapeFields";

const fmt = (n: number, d = 1) => new Intl.NumberFormat("en", { maximumFractionDigits: d }).format(n);

/**
 * Tank calculator: pick a shape, write its measurements and the dipstick reading,
 * and see the litres (same formulas the site uses for the tanks).
 */
export function TankCalculator({ tanks = [] }: { tanks?: Tank[] }) {
  const { t } = useI18n();
  const C = t.diesel.tanks.calculator;
  const [shape, setShape] = useState<Shape>(tanks[0]?.shape ?? "horizontal_cylinder");
  const [dims, setDims] = useState<DimValues>(emptyDims(tanks[0]));
  const [depth, setDepth] = useState("");
  const [from, setFrom] = useState(tanks[0] ? String(tanks[0].id) : "");

  const probe = { shape, ...(Object.fromEntries((Object.keys(dims) as Dim[]).map((d) => [d, parseNum(dims[d])])) as Record<Dim, number | null>) };
  const full = fullCm(probe);
  const cap = full === null ? null : geoLiters(probe, full);
  const f = parseNum(depth);
  const inside = f !== null && full !== null && f >= 0 && f <= full;
  const now = inside ? geoLiters(probe, f!) : null;
  const perCm = inside ? (geoLiters(probe, Math.min(f! + 0.5, full!)) ?? 0) - (geoLiters(probe, Math.max(f! - 0.5, 0)) ?? 0) : null;
  const pct = now !== null && cap ? (now / cap) * 100 : null;

  const pickTank = (id: string) => {
    setFrom(id);
    const tk = tanks.find((x) => String(x.id) === id);
    if (tk) { setShape(tk.shape); setDims(emptyDims(tk)); }
  };

  return (
    <details className="group mt-4 rounded-[14px] bg-canvas">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <CalculatorIcon className="size-4 text-primary" aria-hidden />
        <span className="flex-1">{C.title}<span className="block text-[12.5px] font-normal text-ink-muted">{C.sub}</span></span>
        <ChevronDownIcon className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-4 border-t border-hairline px-3.5 py-4">
        {tanks.length > 0 && (
          <label className="flex flex-col gap-1.5 text-sm font-medium sm:max-w-sm">
            {C.startFrom}
            <NativeSelect value={from} onChange={(e) => pickTank(e.target.value)} className="w-full">
              <NativeSelectOption value="">{C.blank}</NativeSelectOption>
              {tanks.map((tk) => <NativeSelectOption key={tk.id} value={tk.id}>{tk.label}</NativeSelectOption>)}
            </NativeSelect>
          </label>
        )}
        <ShapeFields prefix="calc" shape={shape} onShape={setShape} dims={dims} onDims={setDims} fill={pct === null ? 0.4 : pct / 100}
          below={
            <div className="flex flex-col gap-1.5 rounded-xl border-2 border-transparent bg-surface p-2.5">
              <label htmlFor="calc-depth" className="text-sm font-semibold">{C.depth}</label>
              <NumberInput id="calc-depth" value={depth} onChange={(e) => setDepth(e.target.value)} />
              <span className="text-[12.5px] text-ink-muted">{full !== null ? C.depthHint(fmt(full)) : C.dimsFirst}</span>
              {f !== null && full !== null && !inside && <span role="alert" className="text-[12.5px] font-semibold text-danger">{C.tooDeep(fmt(full))}</span>}
            </div>
          } />
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-live="polite">
          {[
            [C.capacity, cap === null ? "—" : `${fmt(cap)} L`],
            [C.now, now === null ? "—" : `${fmt(now)} L`],
            [C.empty, now === null || cap === null ? "—" : `${fmt(cap - now)} L`],
            [C.percent, pct === null ? "—" : `${fmt(pct, 0)}%`],
            [C.perCm, perCm === null ? "—" : `${fmt(perCm)} L`],
          ].map(([k, v], i) => (
            <div key={k} className={i === 1 ? "rounded-[14px] bg-primary p-3 text-primary-foreground" : "rounded-[14px] bg-surface p-3"}>
              <dt className={i === 1 ? "text-[12.5px] opacity-85" : "text-[12.5px] text-ink-muted"}>{k}</dt>
              <dd className="num m-0 text-[20px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[12px] text-ink-muted">{C.note}</p>
      </div>
    </details>
  );
}
