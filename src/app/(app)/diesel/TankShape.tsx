"use client";
import { useId } from "react";
import type { Shape } from "@/lib/diesel";

/**
 * A simple drawing of each tank shape with the letters of the dimensions to
 * measure (L length, W width, H height, D diameter). The blue part is diesel.
 */
export function TankShape({ shape, className, labels = true }: { shape: Shape; className?: string; labels?: boolean }) {
  const id = useId().replace(/:/g, "");
  const clip = `tk-${id}`;
  const body = { fill: "var(--surface)", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const };
  const back = { ...body, strokeOpacity: 0.45 };
  const dash = { stroke: "currentColor", strokeOpacity: 0.55, strokeWidth: 1, strokeDasharray: "3 3", fill: "none" };
  const fuel = { fill: "var(--brand)", fillOpacity: 0.32 };
  const T = ({ x, y, c }: { x: number; y: number; c: string }) =>
    labels ? <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="var(--primary)">{c}</text> : null;
  const Arrow = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) =>
    labels ? <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--primary)" strokeWidth="1.2" markerStart={`url(#a-${id})`} markerEnd={`url(#a-${id})`} /> : null;

  let art: React.ReactNode = null;
  switch (shape) {
    case "box":
      art = (
        <>
          <path d="M18 34 L42 20 L120 20 L96 34 Z" {...body} />
          <path d="M96 34 L120 20 L120 66 L96 80 Z" {...body} />
          <clipPath id={clip}><rect x="18" y="34" width="78" height="46" /></clipPath>
          <rect x="18" y="34" width="78" height="46" {...body} />
          <rect x="18" y="58" width="78" height="22" clipPath={`url(#${clip})`} {...fuel} />
          <Arrow x1={18} y1={88} x2={96} y2={88} /><T x={57} y={94} c="L" />
          <Arrow x1={9} y1={34} x2={9} y2={80} /><T x={3} y={57} c="H" />
          <Arrow x1={101} y1={86} x2={125} y2={72} /><T x={122} y={84} c="W" />
        </>
      );
      break;
    case "vertical_cylinder":
      art = (
        <>
          <clipPath id={clip}><path d="M30 18 A36 9 0 0 1 102 18 L102 78 A36 9 0 0 1 30 78 Z" /></clipPath>
          <path d="M30 18 A36 9 0 0 1 102 18 L102 78 A36 9 0 0 1 30 78 Z" {...body} />
          <rect x="28" y="52" width="76" height="40" clipPath={`url(#${clip})`} {...fuel} />
          <ellipse cx="66" cy="52" rx="36" ry="9" fill="var(--brand)" fillOpacity="0.2" stroke="none" />
          <ellipse cx="66" cy="18" rx="36" ry="9" {...body} />
          <Arrow x1={30} y1={4} x2={102} y2={4} /><T x={116} y={5} c="D" />
          <Arrow x1={14} y1={18} x2={14} y2={78} /><T x={6} y={48} c="H" />
        </>
      );
      break;
    case "horizontal_cylinder":
      // seen from the end: the circle is the diameter, the length goes back
      art = (
        <>
          <circle cx="98" cy="30" r="26" {...back} />
          <path d="M33 29.5 L87 6 L109 54 L55 77.5 Z" {...body} stroke="none" />
          <line x1="33" y1="29.5" x2="87.8" y2="6" stroke="currentColor" strokeWidth="1.6" />
          <line x1="55" y1="77.5" x2="108.2" y2="54" stroke="currentColor" strokeWidth="1.6" />
          <clipPath id={clip}><circle cx="44" cy="54" r="26" /></clipPath>
          <circle cx="44" cy="54" r="26" {...body} />
          <rect x="16" y="60" width="56" height="22" clipPath={`url(#${clip})`} {...fuel} />
          <Arrow x1={10} y1={28} x2={10} y2={80} /><T x={3} y={54} c="D" />
          <Arrow x1={64} y1={86} x2={122} y2={61} /><T x={102} y={84} c="L" />
        </>
      );
      break;
    case "horizontal_oval":
      art = (
        <>
          <rect x="56" y="16" width="72" height="40" rx="20" {...back} />
          <path d="M26 40 L70 18 L120 54 L76 76 Z" {...body} stroke="none" />
          <line x1="25.7" y1="39.8" x2="69.7" y2="19.8" stroke="currentColor" strokeWidth="1.6" />
          <line x1="78.3" y1="76.2" x2="122.3" y2="56.2" stroke="currentColor" strokeWidth="1.6" />
          <clipPath id={clip}><rect x="14" y="38" width="76" height="40" rx="20" /></clipPath>
          <rect x="14" y="38" width="76" height="40" rx="20" {...body} />
          <rect x="14" y="60" width="76" height="20" clipPath={`url(#${clip})`} {...fuel} />
          <Arrow x1={14} y1={88} x2={90} y2={88} /><T x={52} y={94} c="W" />
          <Arrow x1={5} y1={38} x2={5} y2={78} /><T x={11} y={30} c="H" />
          <Arrow x1={96} y1={80} x2={128} y2={65} /><T x={124} y={80} c="L" />
        </>
      );
      break;
    case "vertical_oval":
      art = (
        <>
          <rect x="70" y="4" width="40" height="68" rx="20" {...back} />
          <path d="M40.7 14.7 L84.7 2.7 L95.3 69.3 L51.3 81.3 Z" {...body} stroke="none" />
          <line x1="40.7" y1="14.7" x2="84.7" y2="2.7" stroke="currentColor" strokeWidth="1.6" />
          <line x1="51.3" y1="81.3" x2="95.3" y2="69.3" stroke="currentColor" strokeWidth="1.6" />
          <clipPath id={clip}><rect x="26" y="14" width="40" height="68" rx="20" /></clipPath>
          <rect x="26" y="14" width="40" height="68" rx="20" {...body} />
          <rect x="26" y="54" width="40" height="30" clipPath={`url(#${clip})`} {...fuel} />
          <Arrow x1={26} y1={90} x2={66} y2={90} /><T x={18} y={91} c="W" />
          <Arrow x1={14} y1={14} x2={14} y2={82} /><T x={6} y={48} c="H" />
          <Arrow x1={72} y1={86} x2={114} y2={75} /><T x={122} y={84} c="L" />
        </>
      );
      break;
    case "horizontal_capsule":
      // side view: round ends, L is the straight part between them
      art = (
        <>
          <clipPath id={clip}><rect x="14" y="22" width="112" height="50" rx="25" /></clipPath>
          <rect x="14" y="22" width="112" height="50" rx="25" {...body} />
          <rect x="14" y="52" width="112" height="22" clipPath={`url(#${clip})`} {...fuel} />
          <line x1="39" y1="22" x2="39" y2="72" {...dash} /><line x1="101" y1="22" x2="101" y2="72" {...dash} />
          <Arrow x1={39} y1={84} x2={101} y2={84} /><T x={70} y={92} c="L" />
          <Arrow x1={6} y1={22} x2={6} y2={72} /><T x={6} y={14} c="D" />
        </>
      );
      break;
    case "vertical_capsule":
      // front view: round top and bottom, H is the straight part between them
      art = (
        <>
          <clipPath id={clip}><rect x="46" y="4" width="48" height="84" rx="24" /></clipPath>
          <rect x="46" y="4" width="48" height="84" rx="24" {...body} />
          <rect x="46" y="58" width="48" height="32" clipPath={`url(#${clip})`} {...fuel} />
          <line x1="46" y1="28" x2="94" y2="28" {...dash} /><line x1="46" y1="64" x2="94" y2="64" {...dash} />
          <Arrow x1={106} y1={28} x2={106} y2={64} /><T x={116} y={46} c="H" />
          <Arrow x1={46} y1={94} x2={94} y2={94} /><T x={36} y={94} c="D" />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 132 98" className={className} role="img" aria-hidden={!labels} focusable="false">
      <defs>
        <marker id={`a-${id}`} viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L6 3 L0 6 Z" fill="var(--primary)" />
        </marker>
      </defs>
      <g className="text-ink">{art}</g>
    </svg>
  );
}
