"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRightIcon, ExternalLinkIcon, LinkIcon, ListTreeIcon, NetworkIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Kpi, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { addItem, createNode, deleteItem, deleteNode, updateNode } from "./actions";
import { CountChips, KIND_ICON } from "./CountChips";
import { buildTree, countItems, FREQS, KINDS, PLATFORMS, STATUS_BADGE, STATUS_DOT, type Counts, type Kind, type PItem, type PNode, type Status, type Tree } from "./tree";

const MindMap = dynamic(() => import("./MindMap").then((m) => m.MindMap), { ssr: false, loading: () => <div className="h-[min(76dvh,820px)] min-h-[480px] rounded-2xl bg-canvas" /> });

const STORE = "plan-collapsed";
const VIEW = "plan-view";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function PlanBoard({ nodes, items }: { nodes: PNode[]; items: PItem[] }) {
  const { t, locale } = useI18n();
  const P = t.plan;
  const rtl = locale === "ar";
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const counts = useMemo(() => countItems(items), [items]);
  const [view, setView] = useState<"map" | "list">("map");
  const [openId, setOpenId] = useState<number | null>(null);
  // by default show the first three levels; deeper ones open on demand
  const defaultCollapsed = useMemo(() => new Set(nodes.filter((n) => tree.depth(n.id) >= 2 && tree.children(n.id).length).map((n) => n.id)), [nodes, tree]);
  const [collapsed, setCollapsed] = useState<Set<number>>(defaultCollapsed);

  useEffect(() => {
    const v = read(VIEW);
    setView(v === "list" || v === "map" ? v : window.matchMedia("(max-width: 767px)").matches ? "list" : "map");
    const c = read(STORE);
    if (c) { try { setCollapsed(new Set(JSON.parse(c) as number[])); } catch { /* ignore */ } }
  }, []);
  const saveCollapsed = (s: Set<number>) => { setCollapsed(s); write(STORE, JSON.stringify([...s])); };
  const toggle = useCallback((id: number) => {
    setCollapsed((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      write(STORE, JSON.stringify([...s]));
      return s;
    });
  }, []);
  const progress = useCallback((d: number, n: number) => P.progressShort(d, n), [P]);
  const platformLabel = useCallback((p: string) => P.platforms[p] ?? p, [P]);
  const pickView = (v: "map" | "list") => { setView(v); write(VIEW, v); };

  const root = tree.roots[0];
  const total = root ? tree.stats.get(root.id)! : { leaves: 0, done: 0, doing: 0 };
  const parents = nodes.filter((n) => tree.children(n.id).length).map((n) => n.id);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={P.title}>
        <Kpi label={P.stats.items} value={total.leaves} highlight />
        <Kpi label={P.stats.done} value={total.done} />
        <Kpi label={P.stats.doing} value={total.doing} tone={total.doing ? "warning" : undefined} />
        <Kpi label={P.stats.todo} value={total.leaves - total.done - total.doing} />
      </section>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label={P.title} className="flex gap-1 rounded-full bg-canvas p-1">
            {(["map", "list"] as const).map((k) => {
              const Icon = k === "map" ? NetworkIcon : ListTreeIcon;
              return (
                <button key={k} role="tab" aria-selected={view === k} onClick={() => pickView(k)}
                  className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150", view === k ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink")}>
                  <Icon className="size-4 rtl:-scale-x-100" aria-hidden />{P[k]}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
            {(["todo", "doing", "done"] as Status[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", STATUS_DOT[s])} aria-hidden />{P.status[s]}</span>
            ))}
            <span className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => saveCollapsed(new Set())}>{P.expandAll}</Button>
              <Button variant="ghost" size="sm" onClick={() => saveCollapsed(new Set(parents.filter((id) => tree.depth(id) >= 1)))}>{P.collapseAll}</Button>
            </span>
          </div>
        </div>

        {!root ? <p className="text-ink-muted">{P.empty}</p>
          : view === "map" ? <MindMap tree={tree} collapsed={collapsed} onToggle={toggle} onOpen={setOpenId} selectedId={openId} rtl={rtl} progress={progress} platformLabel={platformLabel} counts={counts} />
          : <OutlineList tree={tree} collapsed={collapsed} onToggle={toggle} onOpen={setOpenId} counts={counts} />}
      </Panel>

      <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side={rtl ? "left" : "right"} className="w-full overflow-y-auto data-[side=left]:sm:max-w-md data-[side=right]:sm:max-w-md">
          {openId !== null && tree.byId.has(openId) && (
            <NodeDetails key={openId} tree={tree} id={openId} items={items.filter((i) => i.node_id === openId)} onOpen={setOpenId} onDeleted={(parent) => setOpenId(parent)} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function OutlineList({ tree, collapsed, onToggle, onOpen, counts }: { tree: Tree; collapsed: Set<number>; onToggle: (id: number) => void; onOpen: (id: number) => void; counts: Map<number, Counts> }) {
  const { t } = useI18n();
  const Row = ({ id, depth }: { id: number; depth: number }) => {
    const n = tree.byId.get(id)!;
    const kids = tree.children(id);
    const s = tree.stats.get(id)!;
    const open = !collapsed.has(id);
    return (
      <li>
        <div className={cn("flex items-center gap-1 rounded-[14px] py-1.5 pe-2 transition-colors hover:bg-canvas", depth === 0 && "bg-surface-tint hover:bg-surface-tint")} style={{ paddingInlineStart: depth * 18 + 4 }}>
          {kids.length ? (
            <button type="button" onClick={() => onToggle(id)} aria-expanded={open} aria-label={n.title}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <ChevronRightIcon className={cn("size-4 transition-transform duration-150 rtl:-scale-x-100", open && "rotate-90 rtl:-rotate-90")} aria-hidden />
            </button>
          ) : <span className="size-8 shrink-0" aria-hidden />}
          <button type="button" onClick={() => onOpen(id)} className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 text-start">
            {depth > 0 && <span className={cn("size-2.5 shrink-0 rounded-full", STATUS_DOT[s.status])} aria-hidden />}
            <span className={cn("user-text min-w-0 flex-1 truncate", depth <= 1 ? "font-semibold" : "")} dir="auto">{n.title}</span>
            {n.platform && n.platform !== "site" && <span className="shrink-0 rounded-full bg-info-soft px-2 py-0.5 text-[11.5px] font-semibold text-info">{t.plan.platforms[n.platform] ?? n.platform}</span>}
            {counts.get(id) && <CountChips c={counts.get(id)!} />}
            {n.link && <LinkIcon className="size-3.5 shrink-0 text-ink-muted" aria-label={t.plan.onSite} />}
            {kids.length > 0 && <span className="num shrink-0 text-[12.5px] text-ink-muted">{t.plan.progressShort(s.done, s.leaves)}</span>}
          </button>
        </div>
        {kids.length > 0 && open && <ul>{kids.map((c) => <Row key={c.id} id={c.id} depth={depth + 1} />)}</ul>}
      </li>
    );
  };
  return <ul className="flex flex-col gap-0.5">{tree.roots.map((r) => <Row key={r.id} id={r.id} depth={0} />)}</ul>;
}

function NodeDetails({ tree, id, items, onOpen, onDeleted }: { tree: Tree; id: number; items: PItem[]; onOpen: (id: number) => void; onDeleted: (parent: number | null) => void }) {
  const { t } = useI18n();
  const P = t.plan;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const n = tree.byId.get(id)!;
  const kids = tree.children(id);
  const s = tree.stats.get(id)!;
  const path = tree.path(id);
  const [title, setTitle] = useState(n.title);
  const [notes, setNotes] = useState(n.notes ?? "");
  const [policy, setPolicy] = useState(n.policy ?? "");
  const preset = (PLATFORMS as readonly string[]).includes(n.platform ?? "");
  const [otherOpen, setOtherOpen] = useState(Boolean(n.platform) && !preset);
  const [other, setOther] = useState(preset ? "" : n.platform ?? "");
  const [link, setLink] = useState(n.link ?? "");
  const [newChild, setNewChild] = useState("");
  const isRoot = n.parent_id === null;
  // show the click right away; the server result replaces it on refresh
  const [optStatus, setOptStatus] = useState<Status | null>(null);
  useEffect(() => { setOptStatus(null); }, [n.status]);
  const status = optStatus ?? n.status;

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) => start(async () => {
    setError(null);
    const r = await fn();
    if (r.error) { setError(r.error); return; }
    after?.();
    router.refresh();
  });

  const blocked = new Set([id, ...tree.descendants(id)]);
  const moveTargets = [...tree.byId.values()].filter((x) => !blocked.has(x.id)).sort((a, b) => {
    const pa = tree.path(a.id).map((p) => p.sort).join("."), pb = tree.path(b.id).map((p) => p.sort).join(".");
    return pa.localeCompare(pb, undefined, { numeric: true });
  });
  const label = "text-[13px] font-semibold text-ink-muted";

  return (
    <div className="flex flex-col gap-6 p-5 pt-4">
      <SheetHeader className="p-0 pe-10">
        {path.length > 1 && (
          <nav className="flex flex-wrap items-center gap-1 text-[12.5px] text-ink-muted" aria-label={P.path}>
            {path.slice(0, -1).map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <button type="button" onClick={() => onOpen(p.id)} className="hover:text-primary hover:underline" dir="auto">{p.title}</button>
                <ChevronRightIcon className="size-3 rtl:-scale-x-100" aria-hidden />
              </span>
            ))}
          </nav>
        )}
        <SheetTitle className="user-text text-[20px] font-semibold leading-snug text-ink" dir="auto">{n.title}</SheetTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE[s.status]}>{P.status[s.status]}</Badge>
          {kids.length > 0 && <span className="text-[13px] text-ink-muted">{P.progress(s.done, s.leaves)}</span>}
          {pending && <Spinner className="size-4 text-ink-muted" />}
        </div>
        {n.link && (
          <Button variant="outline" size="sm" className="mt-1 self-start" render={n.link.startsWith("/") ? <Link href={n.link} /> : <a href={n.link} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <ExternalLinkIcon data-icon="inline-start" />{P.openPage}
          </Button>
        )}
      </SheetHeader>

      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}

      <section className="flex flex-col gap-2">
        <h3 className={label}>{P.platformLabel}</h3>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={P.platformLabel}>
          {PLATFORMS.map((k) => {
            const on = n.platform === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} disabled={pending}
                onClick={() => { setOtherOpen(false); run(() => updateNode(id, { platform: on ? "" : k })); }}
                className={cn("h-8 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150",
                  on ? "border-primary bg-surface-tint text-accent-foreground" : "border-input text-ink-muted hover:text-ink")}>
                {P.platforms[k]}
              </button>
            );
          })}
          <button type="button" role="radio" aria-checked={otherOpen} onClick={() => setOtherOpen(true)}
            className={cn("h-8 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150",
              otherOpen ? "border-primary bg-surface-tint text-accent-foreground" : "border-input text-ink-muted hover:text-ink")}>
            {otherOpen && other ? other : P.other}
          </button>
        </div>
        {otherOpen && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => updateNode(id, { platform: other })); }}>
            <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder={P.otherPh} aria-label={P.otherPh} dir="auto" />
            <Button type="submit" variant="outline" disabled={pending || !other.trim() || other === n.platform}>{t.common.save}</Button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={label}>{P.policy}</h3>
        <Textarea value={policy} onChange={(e) => setPolicy(e.target.value)} rows={4} placeholder={P.policyPh} aria-label={P.policy} dir="auto" />
        {policy !== (n.policy ?? "") && (
          <Button variant="outline" className="self-start" disabled={pending} onClick={() => run(() => updateNode(id, { policy }))}>{P.savePolicy}</Button>
        )}
      </section>

      {/* status: chosen for a single item, worked out for a group */}
      {kids.length === 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className={label}>{P.statusLabel}</h3>
          <div className="grid grid-cols-3 gap-1 rounded-full bg-canvas p-1" role="radiogroup" aria-label={P.statusLabel}>
            {(["todo", "doing", "done"] as Status[]).map((st) => (
              <button key={st} type="button" role="radio" aria-checked={status === st}
                onClick={() => { setOptStatus(st); run(() => updateNode(id, { status: st })); }}
                className={cn("flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-medium transition-colors duration-150",
                  status === st ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink")}>
                <span className={cn("size-2 rounded-full", STATUS_DOT[st])} aria-hidden />{P.status[st]}
              </button>
            ))}
          </div>
        </section>
      ) : <p className="-mt-3 text-[13px] text-ink-muted">{P.auto}</p>}

      {KINDS.map((k) => <ItemSection key={k} kind={k} nodeId={id} items={items.filter((i) => i.kind === k)} pending={pending} run={run} />)}

      <section className="flex flex-col gap-2">
        <h3 className={label}>{P.notes}</h3>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={P.notesPh} aria-label={P.notes} dir="auto" />
        {notes !== (n.notes ?? "") && (
          <Button variant="outline" className="self-start" disabled={pending} onClick={() => run(() => updateNode(id, { notes }))}>{P.saveNotes}</Button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={label}>{P.subItems}</h3>
        {kids.length > 0 && (
          <ul className="flex flex-col gap-1">
            {kids.map((c) => {
              const cs = tree.stats.get(c.id)!;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-center gap-2.5 rounded-xl bg-canvas px-3 py-2.5 text-start text-sm hover:bg-surface-sunken">
                    <span className={cn("size-2.5 shrink-0 rounded-full", STATUS_DOT[cs.status])} aria-hidden />
                    <span className="user-text min-w-0 flex-1 truncate" dir="auto">{c.title}</span>
                    {tree.children(c.id).length > 0 && <span className="num text-[12.5px] text-ink-muted">{P.progressShort(cs.done, cs.leaves)}</span>}
                    <ChevronRightIcon className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => createNode(id, newChild), () => setNewChild("")); }}>
          <Input value={newChild} onChange={(e) => setNewChild(e.target.value)} placeholder={P.addChildPh} aria-label={P.addChildPh} dir="auto" />
          <Button type="submit" variant="outline" disabled={pending || !newChild.trim()}><PlusIcon data-icon="inline-start" />{P.add}</Button>
        </form>
      </section>

      <details className="group rounded-2xl bg-canvas">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          {P.more}<ChevronRightIcon className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-90 rtl:-scale-x-100 rtl:group-open:-rotate-90" aria-hidden />
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); run(() => updateNode(id, { title })); }}>
            <label htmlFor="pl-title" className={label}>{P.rename}</label>
            <div className="flex gap-2">
              <Input id="pl-title" value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" />
              <Button type="submit" variant="outline" disabled={pending || !title.trim() || title === n.title}>{t.common.save}</Button>
            </div>
          </form>
          <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); run(() => updateNode(id, { link })); }}>
            <label htmlFor="pl-link" className={label}>{P.link}</label>
            <div className="flex gap-2">
              <Input id="pl-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder={P.linkPh} dir="ltr" />
              <Button type="submit" variant="outline" disabled={pending || link === (n.link ?? "")}>{t.common.save}</Button>
            </div>
          </form>
          {!isRoot && (
            <div className="flex flex-col gap-2">
              <label htmlFor="pl-move" className={label}>{P.moveUnder}</label>
              <NativeSelect id="pl-move" value={String(n.parent_id)} disabled={pending} className="w-full"
                onChange={(e) => run(() => updateNode(id, { parent_id: Number(e.target.value) }))}>
                {moveTargets.map((x) => (
                  <NativeSelectOption key={x.id} value={String(x.id)}>{"  ".repeat(tree.depth(x.id))}{x.title}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
          {!isRoot && (
            <Button variant="destructive" className="self-start" disabled={pending}
              onClick={() => { if (window.confirm(P.deleteConfirm(tree.descendants(id).length))) run(() => deleteNode(id), () => onDeleted(n.parent_id)); }}>
              <Trash2Icon data-icon="inline-start" />{P.delete}
            </Button>
          )}
        </div>
      </details>
    </div>
  );
}

/** One of the three fixed sections: files required, reviews (with how often), actions. */
function ItemSection({ kind, nodeId, items, pending, run }: {
  kind: Kind; nodeId: number; items: PItem[]; pending: boolean;
  run: (fn: () => Promise<{ error?: string }>, after?: () => void) => void;
}) {
  const { t } = useI18n();
  const P = t.plan;
  const S = P.sections[kind];
  const Icon = KIND_ICON[kind];
  const [text, setText] = useState("");
  const [freq, setFreq] = useState<string>("monthly");
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink"><Icon className="size-4 text-primary" aria-hidden />{S.title}</h3>
        <p className="text-[12.5px] text-ink-muted">{S.hint}</p>
      </div>
      {items.length === 0 ? <p className="text-sm text-ink-muted">{P.none}</p> : (
        <ul className="flex flex-col gap-1">
          {items.map((i) => (
            <li key={i.id} className="group flex items-start gap-2 rounded-xl bg-canvas px-3 py-2">
              {kind === "review" && i.frequency && <span className="mt-0.5 shrink-0 rounded-full bg-info-soft px-2 py-0.5 text-[11.5px] font-semibold text-info">{P.freq[i.frequency]}</span>}
              <span className="user-text min-w-0 flex-1 text-sm" dir="auto">{i.body}</span>
              <button type="button" onClick={() => run(() => deleteItem(i.id))} aria-label={t.common.delete}
                className="shrink-0 rounded-full p-1 text-ink-muted opacity-60 hover:bg-danger-soft hover:text-danger group-hover:opacity-100">
                <Trash2Icon className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-wrap gap-2 sm:flex-nowrap" onSubmit={(e) => { e.preventDefault(); run(() => addItem(nodeId, text, kind, kind === "review" ? freq : null), () => setText("")); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={S.ph} aria-label={S.title} dir="auto" className="min-w-0 flex-1 basis-full sm:basis-auto" />
        {kind === "review" && (
          <NativeSelect value={freq} onChange={(e) => setFreq(e.target.value)} aria-label={P.howOften} className="w-36">
            {FREQS.map((f) => <NativeSelectOption key={f} value={f}>{P.freq[f]}</NativeSelectOption>)}
          </NativeSelect>
        )}
        <Button type="submit" variant="outline" disabled={pending || !text.trim()}><PlusIcon data-icon="inline-start" />{P.add}</Button>
      </form>
    </section>
  );
}

