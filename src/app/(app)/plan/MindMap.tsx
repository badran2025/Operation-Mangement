"use client";
import "@xyflow/react/dist/style.css";
import { memo, useMemo } from "react";
import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { useTheme } from "next-themes";
import { ChevronRightIcon, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_DOT, type Counts, type Stats, type Tree } from "./tree";
import { CountChips } from "./CountChips";

const COL = 300;
const ROW = 86;
const W = 236;

type Data = {
  title: string; depth: number; stats: Stats; kids: number; collapsed: boolean; rtl: boolean; selected: boolean; linked: boolean; platform: string | null; counts?: Counts;
  progress: string; onToggle: () => void;
};
type PlanNode = Node<Data, "plan">;

const PlanCard = memo(function PlanCard({ data }: NodeProps<PlanNode>) {
  const { stats, depth } = data;
  const pct = stats.leaves ? Math.round((stats.done / stats.leaves) * 100) : 0;
  const root = depth === 0;
  return (
    <div
      dir="auto"
      style={{ width: W }}
      className={cn(
        "relative flex min-h-[60px] cursor-pointer flex-col justify-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-ink transition-shadow duration-150",
        root ? "bg-primary text-primary-foreground" : depth === 1 ? "bg-surface-tint" : "bg-surface outline outline-1 -outline-offset-1 outline-hairline",
        data.selected && "ring-2 ring-primary ring-offset-2 ring-offset-canvas",
      )}
    >
      <Handle type="target" position={data.rtl ? Position.Right : Position.Left} isConnectable={false} className="!pointer-events-none !size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <div className="flex items-start gap-2">
        {!root && <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", STATUS_DOT[stats.status])} aria-hidden />}
        <span className={cn("user-text line-clamp-2 min-w-0 flex-1 text-[14px] leading-snug", depth <= 1 ? "font-semibold" : "font-medium")}>{data.title}</span>
        {data.linked && <LinkIcon className="mt-1 size-3.5 shrink-0 opacity-60" aria-hidden />}
      </div>
      {data.counts && !root && <CountChips c={data.counts} />}
      {data.platform && (
        <span className={cn("self-start rounded-full px-2 py-0.5 text-[11.5px] font-semibold", root ? "bg-white/20" : "bg-info-soft text-info")}>{data.platform}</span>
      )}
      {data.kids > 0 && (
        <div className="flex items-center gap-2" dir={data.rtl ? "rtl" : "ltr"}>
          <span className={cn("h-1.5 flex-1 overflow-hidden rounded-full", root ? "bg-white/25" : "bg-surface-sunken")}>
            <span className={cn("block h-full rounded-full", root ? "bg-white" : "bg-success")} style={{ width: `${pct}%` }} />
          </span>
          <span className={cn("num text-[12px]", root ? "text-primary-foreground/85" : "text-ink-muted")}>{data.progress}</span>
        </div>
      )}
      {data.kids > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); data.onToggle(); }}
          aria-label={data.collapsed ? "+" : "−"}
          aria-expanded={!data.collapsed}
          className={cn(
            "nodrag z-10 absolute top-1/2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-full bg-surface px-1.5 text-[11.5px] font-semibold text-ink-muted shadow-sm outline outline-1 outline-hairline hover:text-ink",
            data.rtl ? "-left-3" : "-right-3",
          )}
        >
          {data.collapsed ? <span className="num">{data.kids}</span> : <ChevronRightIcon className={cn("size-3.5", data.rtl ? "" : "rotate-180")} aria-hidden />}
        </button>
      )}
      <Handle type="source" position={data.rtl ? Position.Left : Position.Right} isConnectable={false} className="!pointer-events-none !size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
    </div>
  );
});

const nodeTypes = { plan: PlanCard };

export function MindMap({ tree, collapsed, onToggle, onOpen, selectedId, rtl, progress, platformLabel, counts }: {
  tree: Tree; collapsed: Set<number>; onToggle: (id: number) => void; onOpen: (id: number) => void;
  selectedId: number | null; rtl: boolean; progress: (done: number, total: number) => string; platformLabel: (p: string) => string; counts: Map<number, Counts>;
}) {
  const { resolvedTheme } = useTheme();
  const { nodes, edges } = useMemo(() => {
    const nodes: PlanNode[] = [];
    const edges: Edge[] = [];
    let row = 0;
    const place = (id: number, depth: number): number => {
      const n = tree.byId.get(id)!;
      const kids = tree.children(id);
      const shown = collapsed.has(id) ? [] : kids;
      let y: number;
      if (shown.length === 0) { y = row * ROW; row += 1; }
      else {
        const ys = shown.map((c) => {
          edges.push({ id: `${id}-${c.id}`, source: String(id), target: String(c.id), type: "default", style: { stroke: "var(--ink-muted)", strokeOpacity: 0.35, strokeWidth: 2 } });
          return place(c.id, depth + 1);
        });
        y = (ys[0] + ys[ys.length - 1]) / 2;
      }
      const s = tree.stats.get(id)!;
      nodes.push({
        id: String(id), type: "plan", position: { x: depth * COL * (rtl ? -1 : 1), y },
        data: {
          title: n.title, depth, stats: s, kids: kids.length, collapsed: collapsed.has(id), rtl, selected: selectedId === id,
          linked: Boolean(n.link), platform: n.platform && n.platform !== "site" ? platformLabel(n.platform) : null, counts: counts.get(id), progress: progress(s.done, s.leaves), onToggle: () => onToggle(id),
        },
      });
      return y;
    };
    tree.roots.forEach((r) => place(r.id, 0));
    return { nodes, edges };
  }, [tree, collapsed, rtl, selectedId, onToggle, progress, platformLabel, counts]);

  return (
    <div dir="ltr" className="h-[min(76dvh,820px)] min-h-[480px] overflow-hidden rounded-2xl bg-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        onNodeClick={(_, n) => onOpen(Number(n.id))}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        fitView
        fitViewOptions={{ padding: 0.08, minZoom: 0.8, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.6}
        style={{ background: "transparent" }}
      >
        <Background gap={24} size={1} color="var(--hairline)" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
