import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { buildTree, FREQS, KINDS, STATUS_BADGE, type PItem, type PNode } from "../tree";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function ManualPage() {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const P = t.plan;
  const [{ data: nodes }, { data: items }] = await Promise.all([
    supabase.from("plan_nodes").select("id, parent_id, title, status, notes, link, sort, platform, policy"),
    supabase.from("plan_items").select("id, node_id, body, done, sort, kind, frequency").order("sort").order("id"),
  ]);
  const tree = buildTree((nodes ?? []) as PNode[]);
  const all = (items ?? []) as PItem[];
  const root = tree.roots[0];
  const freqOrder = (f: string | null) => (f ? FREQS.indexOf(f as (typeof FREQS)[number]) : 99);

  const Topic = ({ n, num, depth }: { n: PNode; num: string; depth: number }) => {
    const kids = tree.children(n.id);
    const mine = all.filter((i) => i.node_id === n.id);
    const s = tree.stats.get(n.id)!;
    const H = depth === 1 ? "h2" : depth === 2 ? "h3" : "h4";
    const empty = !n.policy && mine.length === 0 && !n.notes;
    return (
      <section className={cn("break-inside-avoid-page", depth === 1 ? "rounded-2xl bg-surface p-5 md:p-7 print:rounded-none print:p-0" : "border-s-2 border-hairline ps-4 md:ps-5")}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <H className={cn("user-text font-semibold text-ink", depth === 1 ? "text-[22px]" : depth === 2 ? "text-[17px]" : "text-[15px]")} dir="auto">
            <span className="num me-2 text-ink-muted">{num}</span>{n.title}
          </H>
          <Badge variant={STATUS_BADGE[s.status]}>{P.status[s.status]}</Badge>
          {n.platform && <span className="text-[13px] text-ink-muted">{P.runsOn}: <b className="font-semibold text-info">{P.platforms[n.platform] ?? n.platform}</b></span>}
          {n.link?.startsWith("/") && (
            <Link href={n.link} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline print:hidden"><ExternalLinkIcon className="size-3.5" aria-hidden />{P.openPage}</Link>
          )}
        </div>

        <div className="mt-2 flex flex-col gap-3 text-[14.5px]">
          {n.policy && (
            <div>
              <h5 className="text-[13px] font-semibold text-ink-muted">{P.rules}</h5>
              <p className="user-text whitespace-pre-line" dir="auto">{n.policy}</p>
            </div>
          )}
          {KINDS.map((k) => {
            const list = mine.filter((i) => i.kind === k).sort((a, b) => (k === "review" ? freqOrder(a.frequency) - freqOrder(b.frequency) : 0) || a.sort - b.sort);
            if (!list.length) return null;
            return (
              <div key={k}>
                <h5 className="text-[13px] font-semibold text-ink-muted">{P.sections[k].title}</h5>
                <ul className="mt-1 flex list-disc flex-col gap-0.5 ps-5 marker:text-ink-muted">
                  {list.map((i) => (
                    <li key={i.id}>
                      {k === "review" && i.frequency && <b className="font-semibold text-info">{P.freq[i.frequency]}: </b>}<span dir="auto">{i.body}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {n.notes && (
            <div>
              <h5 className="text-[13px] font-semibold text-ink-muted">{P.notes}</h5>
              <p className="user-text whitespace-pre-line text-ink-muted" dir="auto">{n.notes}</p>
            </div>
          )}
          {empty && kids.length === 0 && <p className="text-[13.5px] text-warning">{P.notDefined}</p>}
        </div>

        {kids.length > 0 && (
          <div className={cn("flex flex-col", depth === 1 ? "mt-5 gap-5" : "mt-3 gap-3")}>
            {kids.map((c, i) => <Topic key={c.id} n={c} num={`${num}.${i + 1}`} depth={depth + 1} />)}
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <PageHeader back={{ href: "/plan", label: P.backToPlan }} title={P.manual} sub={P.manualSub}>
        <span className="print:hidden"><PrintButton label={P.print} /></span>
      </PageHeader>
      {root && <div className="flex flex-col gap-5 print:gap-8">{tree.children(root.id).map((n, i) => <Topic key={n.id} n={n} num={String(i + 1)} depth={1} />)}</div>}
    </>
  );
}
