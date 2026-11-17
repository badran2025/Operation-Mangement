export type Status = "todo" | "doing" | "done";
export type PNode = { id: number; parent_id: number | null; title: string; status: Status; notes: string | null; link: string | null; sort: number; platform: string | null; policy: string | null };
export type PItem = { id: number; node_id: number; body: string; done: boolean; sort: number };
export type Stats = { leaves: number; done: number; doing: number; status: Status };

/** Children per node, roots, and progress worked out from the leaves under each node. */
export function buildTree(nodes: PNode[]) {
  const kids = new Map<number | null, PNode[]>();
  for (const n of nodes) kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n]);
  for (const list of kids.values()) list.sort((a, b) => a.sort - b.sort || a.id - b.id);
  const children = (id: number | null) => kids.get(id) ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const stats = new Map<number, Stats>();
  const walk = (n: PNode): Stats => {
    const c = children(n.id);
    let s: Stats;
    if (c.length === 0) s = { leaves: 1, done: n.status === "done" ? 1 : 0, doing: n.status === "doing" ? 1 : 0, status: n.status };
    else {
      const sub = c.map(walk);
      const leaves = sub.reduce((a, x) => a + x.leaves, 0), done = sub.reduce((a, x) => a + x.done, 0), doing = sub.reduce((a, x) => a + x.doing, 0);
      s = { leaves, done, doing, status: done === leaves ? "done" : done || doing ? "doing" : "todo" };
    }
    stats.set(n.id, s);
    return s;
  };
  children(null).forEach(walk);
  const path = (id: number): PNode[] => {
    const out: PNode[] = [];
    for (let n = byId.get(id); n; n = n.parent_id ? byId.get(n.parent_id) : undefined) out.unshift(n);
    return out;
  };
  const descendants = (id: number): number[] => children(id).flatMap((c) => [c.id, ...descendants(c.id)]);
  const depth = (id: number) => path(id).length - 1;
  return { children, byId, stats, path, descendants, depth, roots: children(null) };
}
export type Tree = ReturnType<typeof buildTree>;

/** Systems an item can run on; anything else is stored as typed. */
export const PLATFORMS = ["site", "odoo", "sheets", "whatsapp", "paper"] as const;

export const STATUS_DOT: Record<Status, string> = { todo: "bg-ink-muted/35", doing: "bg-warning", done: "bg-success" };
export const STATUS_BADGE: Record<Status, "neutral" | "warning" | "success"> = { todo: "neutral", doing: "warning", done: "success" };
