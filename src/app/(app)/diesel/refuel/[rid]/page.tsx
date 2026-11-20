import { notFound } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { PageHeader, Panel } from "@/components/app/blocks";
import { RefuelForm, type Reading } from "../../Forms";
import { loadDieselForm } from "../../load";

export const dynamic = "force-dynamic";

/** Edit a recorded delivery: the same form, filled in. */
export default async function EditRefuelPage({ params }: { params: Promise<{ rid: string }> }) {
  const { t } = await getT();
  const rid = Number((await params).rid);
  const data = await loadDieselForm();
  const { supabase } = await requireActive();
  const [{ data: r }, { data: dips }] = await Promise.all([
    supabase.from("diesel_refuels").select("*").eq("id", rid).maybeSingle(),
    supabase.from("diesel_dips").select("tank_id, kind, level_cm, liters, entered_as").eq("refuel_id", rid),
  ]);
  if (!r) notFound();
  const readings: Record<number, Reading> = {};
  for (const d of dips ?? []) {
    const unit = d.entered_as === "liters" ? "liters" : "cm";
    const v = String(unit === "liters" ? d.liters : d.level_cm);
    readings[d.tank_id] = { ...(readings[d.tank_id] ?? { unit, b: "", a: "" }), unit, [d.kind === "before" ? "b" : "a"]: v };
  }
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader back={{ href: `/diesel?b=${r.branch_id}&tab=tanks`, label: t.diesel.title }} title={t.diesel.form.editTitle} />
      <Panel className="mt-6">
        <RefuelForm {...data} initial={{ id: rid, branchId: r.branch_id, date: r.refuel_date, ordered: s(r.liters), total: "", price: s(r.price_per_liter), supplier: s(r.supplier), invoice: s(r.invoice_no), notes: s(r.notes), readings }} />
      </Panel>
    </div>
  );
}
