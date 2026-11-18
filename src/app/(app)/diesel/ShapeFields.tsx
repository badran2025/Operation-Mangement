"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { DIMS, SHAPES, type Dim, type Shape } from "@/lib/diesel";
import { NumberInput } from "@/components/NumberInput";
import { cn } from "@/lib/utils";
import { DIM_COLOR, DIM_LETTER, TankShape } from "./TankShape";

export type DimValues = Record<Dim, string>;
export const emptyDims = (t?: Partial<Record<Dim, number | null>>): DimValues => ({
  length_cm: t?.length_cm ? String(t.length_cm) : "", width_cm: t?.width_cm ? String(t.width_cm) : "",
  height_cm: t?.height_cm ? String(t.height_cm) : "", diameter_cm: t?.diameter_cm ? String(t.diameter_cm) : "",
});

type Texts = { dims: Record<string, string>; dimHelp: Record<string, string> };
/** "Length (cm)"; for capsules the length/height is only the straight part. */
export function dimLabel(T: Texts, shape: Shape, d: Dim) {
  if (shape === "horizontal_capsule" && d === "length_cm") return T.dims.straightL;
  if (shape === "vertical_capsule" && d === "height_cm") return T.dims.straightH;
  return T.dims[d];
}
const dimHelp = (T: Texts, shape: Shape, d: Dim) => T.dimHelp[`${shape}.${d}`] ?? T.dimHelp[d];

/** Shape picker (pictures), the big drawing with coloured measurements, and one box per measurement. */
export function ShapeFields({ prefix, shape, onShape, dims, onDims, named = false, fill, below }: {
  prefix: string; shape: Shape; onShape: (s: Shape) => void; dims: DimValues; onDims: (d: DimValues) => void;
  named?: boolean; fill?: number; below?: React.ReactNode;
}) {
  const { t } = useI18n();
  const T = t.diesel.tanks;
  const [active, setActive] = useState<Dim | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{T.shape}</legend>
        {named && <input type="hidden" name="shape" value={shape} />}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" role="radiogroup" aria-label={T.shape}>
          {SHAPES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={shape === s} onClick={() => onShape(s)}
              className={cn("flex flex-col items-center gap-1 rounded-[14px] border bg-surface p-2 text-center text-[12.5px] font-medium transition-colors duration-150",
                shape === s ? "border-primary bg-surface-tint text-primary ring-2 ring-primary/30" : "border-hairline hover:border-primary/50")}>
              <TankShape shape={s} className="h-14 w-full" />
              {T.shapes[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 rounded-2xl bg-canvas p-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-4">
        <div className="flex flex-col gap-2">
          <TankShape shape={shape} measures active={active} fill={fill} className="mx-auto aspect-[200/165] w-full max-w-[460px]" />
          <p className="text-center text-sm font-semibold">{T.shapes[shape]}</p>
          <p className="text-center text-[13px] text-ink-muted">{T.shapeHint[shape]}</p>
        </div>
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-surface px-3 py-2 text-[12.5px] text-ink-muted">{T.inside}</p>
          {DIMS[shape].map((d) => (
            <div key={`${shape}-${d}`} className={cn("flex flex-col gap-1.5 rounded-xl border-2 bg-surface p-2.5 transition-colors duration-150", active === d ? "" : "border-transparent")}
              style={active === d ? { borderColor: DIM_COLOR[d] } : undefined}>
              <label htmlFor={`${prefix}-${d}`} className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-extrabold text-white" style={{ background: DIM_COLOR[d] }} aria-hidden>{DIM_LETTER[d]}</span>
                {dimLabel(T, shape, d)} *
              </label>
              <NumberInput id={`${prefix}-${d}`} name={named ? d : undefined} required value={dims[d]}
                onFocus={() => setActive(d)} onBlur={() => setActive(null)}
                onChange={(e) => onDims({ ...dims, [d]: e.target.value })} aria-describedby={`${prefix}-${d}-h`} />
              <span id={`${prefix}-${d}-h`} className="text-[12.5px] leading-5 text-ink-muted">{dimHelp(T, shape, d)}</span>
            </div>
          ))}
          {below}
        </div>
      </div>
    </div>
  );
}
