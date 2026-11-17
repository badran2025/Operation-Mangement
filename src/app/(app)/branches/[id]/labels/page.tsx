import { notFound } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { PageHeader } from "@/components/app/blocks";
import { PrintButton } from "../../../plan/manual/PrintButton";

export const dynamic = "force-dynamic";

/** Sticker sheet: one label per item, sized to cut out (3 per row on A4). */
export default async function LabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase } = await requireActive();
  const { t, locale } = await getT();
  const E = t.branchesTab.equipment;
  const [{ data: branch }, { data: items }] = await Promise.all([
    supabase.from("branches").select("name_ar, name_en").eq("id", id).maybeSingle(),
    supabase.from("equipment").select("id, code, name, quantity").eq("branch_id", id).neq("status", "retired"),
  ]);
  if (!branch) notFound();
  const name = pick(locale, branch.name_ar, branch.name_en);
  const list = (items ?? []).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  return (
    <>
      <PageHeader back={{ href: `/branches/${id}?s=equipment`, label: name }} title={E.labelsTitle(name)} sub={E.labelsSub}>
        <span className="print:hidden"><PrintButton label={t.plan.print} /></span>
      </PageHeader>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-0">
        {list.map((e) => (
          <li key={e.id} className="flex break-inside-avoid flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-hairline bg-surface p-4 text-center print:rounded-none print:border-black/40 print:p-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Kleen · {branch.name_en}</span>
            <span className="num text-[26px] font-bold leading-tight tracking-wide text-ink" dir="ltr">{e.code}</span>
            <span className="text-[13px] text-ink" dir="auto">{e.name}{e.quantity > 1 && ` ×${e.quantity}`}</span>
            <span className="text-[11px] text-ink-muted">{E.reportBy}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
