import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { PageHeader, Panel } from "@/components/app/blocks";
import { loadPerformance, monthOf } from "../perf";
import { MonthForm } from "./MonthForm";

export const dynamic = "force-dynamic";

/** Monthly figures per branch: pieces and blankets, and (optionally) the month's own litres and cost. */
export default async function MonthsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const month = monthOf((await searchParams).m);
  const [perf, { data: rows }] = await Promise.all([
    loadPerformance(supabase, month, 0),
    supabase.from("branch_months").select("*").eq("month", `${month}-01`),
  ]);
  const P = t.diesel.perf;
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader back={{ href: `/diesel?m=${month}`, label: t.diesel.title }} title={P.enterTitle} sub={P.enterSub} />
      <Panel className="mt-6">
        <MonthForm month={month} today={monthOf(null)}
          branches={perf.branches.map((b) => {
            const r = (rows ?? []).find((x) => x.branch_id === b.id);
            const auto = perf.at(b.id, month);
            return {
              id: b.id, name: pick(locale, b.name_ar, b.name_en),
              pieces: r?.pieces ?? null, blankets: r?.blankets ?? null, liters: r?.liters ?? null, cost: r?.cost ?? null, estimated: !!r?.estimated,
              autoLiters: auto.source === "readings" || auto.source === "partial" ? auto.liters : null, autoComplete: auto.source === "readings", hasTanks: auto.hasTanks,
              delivered: auto.delivered, deliveredCost: auto.deliveredCost, deliveries: auto.deliveries,
            };
          })} />
        <p className="mt-4 text-[12.5px] text-ink-muted">{P.electric}</p>
      </Panel>
    </div>
  );
}
