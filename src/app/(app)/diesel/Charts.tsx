/**
 * Small server-rendered SVG charts for the diesel analysis. One axis each, thin
 * marks, recessive grid, a native tooltip (<title>) on every mark, status colours
 * only with a written label next to them.
 */
const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
export const STATUS_COLOR: Record<string, string> = { risk: "var(--danger)", watch: "#c27a00", good: "var(--success)", normal: "var(--primary)", none: "var(--ink-muted)" };

const niceMax = (v: number) => { if (v <= 0) return 1; const step = 10 ** Math.floor(Math.log10(v)) / 2; return Math.ceil((v * 1.04) / step) * step; };

/** A tiny line of a branch's last months, for tables. */
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <span className="text-ink-muted">—</span>;
  const w = 96, h = 26, lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  const x = (i: number) => 3 + (i / Math.max(values.length - 1, 1)) * (w - 6);
  const y = (v: number) => (hi === lo ? h / 2 : 3 + (1 - (v - lo) / (hi - lo)) * (h - 6));
  const last = pts[pts.length - 1], first = pts[0];
  const worse = last.v > first.v;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} fill="none" stroke="var(--ink-muted)" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={3.5} fill={worse ? "var(--danger)" : "var(--success)"} stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}

type Dot = { id: number; label: string; x: number; y: number; status: string; tip: string };
/** Pieces (x) against litres (y), with the network-average line. */
export function Scatter({ dots, slope, xLabel, yLabel, avgLabel, legend }: { dots: Dot[]; slope: number | null; xLabel: string; yLabel: string; avgLabel: string; legend: [string, string][] }) {
  const W = 680, H = 360, L = 58, R = 16, T = 14, B = 44;
  const xm = niceMax(Math.max(...dots.map((d) => d.x), 1)), ym = niceMax(Math.max(...dots.map((d) => d.y), slope ? slope * xm : 1, 1));
  const X = (v: number) => L + (v / xm) * (W - L - R), Y = (v: number) => H - B - (v / ym) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${xLabel} / ${yLabel}`} style={{ direction: "ltr" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(t * ym)} y2={Y(t * ym)} stroke="var(--hairline)" />
            <text x={L - 8} y={Y(t * ym) + 4} textAnchor="end" fontSize={11} fill="var(--ink-muted)">{f0.format(t * ym)}</text>
            <text x={X(t * xm)} y={H - B + 18} textAnchor="middle" fontSize={11} fill="var(--ink-muted)">{f0.format(t * xm)}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--ink-muted)">{xLabel}</text>
        <text x={14} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--ink-muted)" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>{yLabel}</text>
        {slope && <>
          <line x1={X(0)} y1={Y(0)} x2={X(Math.min(xm, ym / slope))} y2={Y(Math.min(xm, ym / slope) * slope)} stroke="var(--ink-muted)" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={X(Math.min(xm, ym / slope)) - 4} y={Y(Math.min(xm, ym / slope) * slope) - 6} textAnchor="end" fontSize={11} fill="var(--ink-muted)">{avgLabel}</text>
        </>}
        {dots.map((d) => (
          <g key={d.id}>
            <circle cx={X(d.x)} cy={Y(d.y)} r={14} fill="transparent"><title>{d.tip}</title></circle>
            <circle cx={X(d.x)} cy={Y(d.y)} r={6} fill={STATUS_COLOR[d.status]} stroke="var(--surface)" strokeWidth={2} pointerEvents="none" />
            {d.status === "risk" && <text x={X(d.x) + 9} y={Y(d.y) + 4} fontSize={11} fill="var(--ink)" pointerEvents="none">{d.label}</text>}
          </g>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
        {legend.map(([k, label]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} aria-hidden />{label}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-ink-muted" aria-hidden />{avgLabel}</span>
      </figcaption>
    </figure>
  );
}

/** Horizontal bars, one highlighted (the branch being looked at), with a reference line. */
export function Bars({ items, mark, refLabel, unit }: { items: { label: string; value: number; highlight?: boolean }[]; mark?: number | null; refLabel?: string; unit: string }) {
  const max = niceMax(Math.max(...items.map((i) => i.value), mark ?? 0, 1));
  return (
    <div className="flex flex-col gap-1.5" role="list">
      {items.map((it) => (
        <div key={it.label} role="listitem" className="grid grid-cols-[minmax(0,9rem)_1fr_4rem] items-center gap-3 text-sm" title={`${it.label}: ${f0.format(it.value)} ${unit}`}>
          <span className={it.highlight ? "truncate font-semibold" : "truncate text-ink-muted"}>{it.label}</span>
          <span className="relative h-5 rounded-e-[4px] bg-surface-sunken">
            <span className="absolute inset-y-0 start-0 rounded-e-[4px]" style={{ width: `${(it.value / max) * 100}%`, background: it.highlight ? "var(--primary)" : "var(--ink-muted)", opacity: it.highlight ? 1 : 0.45 }} />
            {mark ? <span className="absolute inset-y-[-3px] w-0.5 bg-ink" style={{ insetInlineStart: `${(mark / max) * 100}%` }} title={refLabel} /> : null}
          </span>
          <span className="num text-end font-semibold">{f0.format(it.value)}</span>
        </div>
      ))}
      {mark ? <p className="m-0 flex items-center gap-2 text-[12.5px] text-ink-muted"><span className="h-3 w-0.5 bg-ink" aria-hidden />{refLabel}: <span className="num">{f0.format(mark)}</span></p> : null}
    </div>
  );
}

/** A branch against the network over the months (two series, one axis). */
export function Lines({ labels, series }: { labels: string[]; series: { name: string; values: (number | null)[]; color: string; dashed?: boolean }[] }) {
  const W = 680, H = 260, L = 50, R = 16, T = 14, B = 34;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const ym = niceMax(Math.max(...all, 1));
  const X = (i: number) => L + (labels.length === 1 ? 0.5 : i / (labels.length - 1)) * (W - L - R), Y = (v: number) => H - B - (v / ym) * (H - T - B);
  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.name).join(" / ")} style={{ direction: "ltr" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={Y(t * ym)} y2={Y(t * ym)} stroke="var(--hairline)" /><text x={L - 8} y={Y(t * ym) + 4} textAnchor="end" fontSize={11} fill="var(--ink-muted)">{f0.format(t * ym)}</text></g>
        ))}
        {labels.map((l, i) => <text key={l} x={X(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--ink-muted)">{l}</text>)}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [X(i), Y(v), v, i] as const)).filter((p) => p !== null);
          return (
            <g key={s.name}>
              <polyline points={pts.map((p) => `${p![0]},${p![1]}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
              {pts.map((p) => (
                <g key={p![3]}>
                  <circle cx={p![0]} cy={p![1]} r={12} fill="transparent"><title>{`${s.name} · ${labels[p![3]]}: ${f0.format(p![2])}`}</title></circle>
                  <circle cx={p![0]} cy={p![1]} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} pointerEvents="none" />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 text-[12.5px] text-ink-muted">
        {series.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2" style={{ borderColor: s.color, borderStyle: s.dashed ? "dashed" : "solid" }} aria-hidden />{s.name}</span>)}
      </figcaption>
    </figure>
  );
}
