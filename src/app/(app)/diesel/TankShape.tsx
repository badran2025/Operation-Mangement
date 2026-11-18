"use client";
import { useId } from "react";
import type { Dim, Shape } from "@/lib/diesel";

/** One colour per measurement, used on the drawing and next to its box. */
export const DIM_COLOR: Record<Dim, string> = { length_cm: "#f76707", width_cm: "#7950f2", height_cm: "#2f9e44", diameter_cm: "#e64980" };
export const DIM_LETTER: Record<Dim, string> = { length_cm: "L", width_cm: "W", height_cm: "H", diameter_cm: "D" };

type P = [number, number];
// where the diesel can reach on the drawing (top and bottom y), to draw the level
const SPAN: Record<Shape, [number, number]> = {
  box: [55, 135], vertical_cylinder: [30, 125], horizontal_cylinder: [60, 150], horizontal_oval: [85, 145],
  vertical_oval: [40, 150], horizontal_capsule: [40, 120], vertical_capsule: [15, 145],
};

/**
 * A drawing of a tank shape. With `measures`, every dimension to measure is
 * drawn in its own colour exactly where it is taken, and `active` makes one
 * stand out (the one being typed). `fill` (0–1) sets the diesel level.
 */
export function TankShape({ shape, className, measures = false, active = null, fill = 0.4 }: {
  shape: Shape; className?: string; measures?: boolean; active?: Dim | null; fill?: number;
}) {
  const id = useId().replace(/:/g, "");
  const clip = `tk-${id}`;
  const body = { fill: "var(--surface)", stroke: "currentColor", strokeWidth: 2, strokeLinejoin: "round" as const };
  const back = { ...body, strokeOpacity: 0.4 };
  const edge = { stroke: "currentColor", strokeWidth: 2 };
  const dash = { stroke: "currentColor", strokeOpacity: 0.5, strokeWidth: 1.2, strokeDasharray: "4 4", fill: "none" };
  const [top, bottom] = SPAN[shape];
  const level = bottom - Math.min(Math.max(fill, 0), 1) * (bottom - top);
  const fuel = (x: number, w: number) => <rect x={x} y={level} width={w} height={170 - level} clipPath={`url(#${clip})`} fill="var(--brand)" fillOpacity={0.3} />;

  const on = (d: Dim) => !active || active === d;
  /** A measurement from a to b; with `off` it is drawn beside the shape with dashed guides back to a and b. */
  const M = ({ d, a, b, off = [0, 0], badge }: { d: Dim; a: P; b: P; off?: P; badge?: P }) => {
    if (!measures) return null;
    const c = DIM_COLOR[d], w = active === d ? 4.5 : 3;
    const A: P = [a[0] + off[0], a[1] + off[1]], B: P = [b[0] + off[0], b[1] + off[1]];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    const n: P = [-(B[1] - A[1]) / len * 7, (B[0] - A[0]) / len * 7];
    const m: P = badge ?? [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    return (
      <g opacity={on(d) ? 1 : 0.25}>
        {(off[0] || off[1]) ? <><line x1={a[0]} y1={a[1]} x2={A[0]} y2={A[1]} stroke={c} strokeWidth={1.4} strokeDasharray="3 3" /><line x1={b[0]} y1={b[1]} x2={B[0]} y2={B[1]} stroke={c} strokeWidth={1.4} strokeDasharray="3 3" /></> : null}
        <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={c} strokeWidth={w} strokeLinecap="round" />
        <line x1={A[0] - n[0]} y1={A[1] - n[1]} x2={A[0] + n[0]} y2={A[1] + n[1]} stroke={c} strokeWidth={w - 0.5} strokeLinecap="round" />
        <line x1={B[0] - n[0]} y1={B[1] - n[1]} x2={B[0] + n[0]} y2={B[1] + n[1]} stroke={c} strokeWidth={w - 0.5} strokeLinecap="round" />
        <circle cx={m[0]} cy={m[1]} r={active === d ? 11 : 9.5} fill={c} stroke="var(--surface)" strokeWidth={2} />
        <text x={m[0]} y={m[1] + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={active === d ? 12.5 : 11} fontWeight="800" fill="#fff">{DIM_LETTER[d]}</text>
      </g>
    );
  };
  /** A coloured area: the part that a measurement covers (the straight part of a capsule). */
  const Area = ({ d, x, y, w, h }: { d: Dim; x: number; y: number; w: number; h: number }) =>
    measures ? <rect x={x} y={y} width={w} height={h} fill={DIM_COLOR[d]} fillOpacity={active === d ? 0.28 : active ? 0.06 : 0.14} clipPath={`url(#${clip})`} /> : null;

  let art: React.ReactNode = null;
  switch (shape) {
    case "box":
      art = (
        <>
          <path d="M30 55 L70 25 L180 25 L140 55 Z" {...body} />
          <path d="M140 55 L180 25 L180 105 L140 135 Z" {...body} />
          <clipPath id={clip}><rect x="30" y="55" width="110" height="80" /></clipPath>
          <rect x="30" y="55" width="110" height="80" {...body} />
          {fuel(30, 110)}
          <M d="length_cm" a={[30, 135]} b={[140, 135]} off={[0, 14]} />
          <M d="height_cm" a={[30, 55]} b={[30, 135]} off={[-16, 0]} />
          <M d="width_cm" a={[140, 135]} b={[180, 105]} off={[10, 10]} />
        </>
      );
      break;
    case "vertical_cylinder":
      art = (
        <>
          <clipPath id={clip}><path d="M45 30 A55 14 0 0 1 155 30 L155 125 A55 14 0 0 1 45 125 Z" /></clipPath>
          <path d="M45 30 A55 14 0 0 1 155 30 L155 125 A55 14 0 0 1 45 125 Z" {...body} />
          {fuel(40, 120)}
          <ellipse cx="100" cy="30" rx="55" ry="14" {...body} />
          <M d="diameter_cm" a={[45, 30]} b={[155, 30]} />
          <M d="height_cm" a={[45, 30]} b={[45, 125]} off={[-18, 0]} />
        </>
      );
      break;
    case "horizontal_cylinder":
      art = (
        <>
          <circle cx="142" cy="55" r="45" {...back} />
          <path d="M38.1 66.8 L118.1 16.8 L165.9 93.2 L85.9 143.2 Z" fill="var(--surface)" />
          <line x1="38.1" y1="66.8" x2="118.1" y2="16.8" {...edge} />
          <line x1="85.9" y1="143.2" x2="165.9" y2="93.2" {...edge} />
          <clipPath id={clip}><circle cx="62" cy="105" r="45" /></clipPath>
          <circle cx="62" cy="105" r="45" {...body} />
          {fuel(15, 95)}
          <M d="diameter_cm" a={[62, 60]} b={[62, 150]} />
          <M d="length_cm" a={[85.9, 143.2]} b={[165.9, 93.2]} off={[8, 12]} />
        </>
      );
      break;
    case "horizontal_oval":
      art = (
        <>
          <rect x="80" y="35" width="110" height="60" rx="30" {...back} />
          <path d="M30.8 92 L90.8 42 L179.2 88 L119.2 138 Z" fill="var(--surface)" />
          <line x1="30.8" y1="92" x2="90.8" y2="42" {...edge} />
          <line x1="119.2" y1="138" x2="179.2" y2="88" {...edge} />
          <clipPath id={clip}><rect x="20" y="85" width="110" height="60" rx="30" /></clipPath>
          <rect x="20" y="85" width="110" height="60" rx="30" {...body} />
          {fuel(20, 110)}
          <M d="width_cm" a={[20, 115]} b={[130, 115]} />
          <M d="height_cm" a={[95, 85]} b={[95, 145]} badge={[95, 132]} />
          <M d="length_cm" a={[119.2, 138]} b={[179.2, 88]} off={[10, 12]} />
        </>
      );
      break;
    case "vertical_oval":
      art = (
        <>
          <rect x="100" y="10" width="60" height="110" rx="30" {...back} />
          <path d="M48.2 42.4 L118.2 12.4 L141.8 117.6 L71.8 147.6 Z" fill="var(--surface)" />
          <line x1="48.2" y1="42.4" x2="118.2" y2="12.4" {...edge} />
          <line x1="71.8" y1="147.6" x2="141.8" y2="117.6" {...edge} />
          <clipPath id={clip}><rect x="30" y="40" width="60" height="110" rx="30" /></clipPath>
          <rect x="30" y="40" width="60" height="110" rx="30" {...body} />
          {fuel(30, 60)}
          <M d="height_cm" a={[60, 40]} b={[60, 150]} badge={[60, 62]} />
          <M d="width_cm" a={[30, 95]} b={[90, 95]} badge={[45, 95]} />
          <M d="length_cm" a={[71.8, 147.6]} b={[141.8, 117.6]} off={[8, 10]} />
        </>
      );
      break;
    case "horizontal_capsule":
      art = (
        <>
          <clipPath id={clip}><rect x="20" y="40" width="160" height="80" rx="40" /></clipPath>
          <rect x="20" y="40" width="160" height="80" rx="40" {...body} />
          <Area d="length_cm" x={60} y={40} w={80} h={80} />
          {fuel(20, 160)}
          <line x1="60" y1="40" x2="60" y2="120" {...dash} /><line x1="140" y1="40" x2="140" y2="120" {...dash} />
          <M d="length_cm" a={[60, 120]} b={[140, 120]} off={[0, 22]} />
          <M d="diameter_cm" a={[100, 40]} b={[100, 120]} badge={[100, 62]} />
        </>
      );
      break;
    case "vertical_capsule":
      art = (
        <>
          <clipPath id={clip}><rect x="70" y="15" width="60" height="130" rx="30" /></clipPath>
          <rect x="70" y="15" width="60" height="130" rx="30" {...body} />
          <Area d="height_cm" x={70} y={45} w={60} h={70} />
          {fuel(70, 60)}
          <line x1="70" y1="45" x2="130" y2="45" {...dash} /><line x1="70" y1="115" x2="130" y2="115" {...dash} />
          <M d="height_cm" a={[130, 45]} b={[130, 115]} off={[24, 0]} />
          <M d="diameter_cm" a={[70, 80]} b={[130, 80]} />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 200 165" className={className} role="img" aria-hidden focusable="false">
      <g className="text-ink">{art}</g>
    </svg>
  );
}
