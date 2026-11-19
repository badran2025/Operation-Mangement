/**
 * Small server-rendered SVG charts for the diesel analysis. One axis each, thin
 * marks, recessive grid, a native tooltip (<title>) on every mark, status colours
 * only with a written label next to them.
 */
const f0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
export const STATUS_COLOR: Record<string, string> = { risk: "var(--danger)", watch: "#c27a00", good: "var(--success)", normal: "var(--primary)", none: "var(--ink-muted)" };

const niceMax = (v: number) => { if (v <= 0) return 1; const step = 10 ** Math.floor(Math.log10(v)) / 2; return Math.ceil((v * 1.04) / step) * step; };

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
