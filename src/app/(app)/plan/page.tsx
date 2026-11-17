import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/app/blocks";
import { PlanBoard } from "./PlanBoard";
import type { PItem, PNode } from "./tree";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const [{ data: nodes }, { data: items }] = await Promise.all([
    supabase.from("plan_nodes").select("id, parent_id, title, status, notes, link, sort, platform, policy"),
    supabase.from("plan_items").select("id, node_id, body, done, sort").order("sort").order("id"),
  ]);
  return (
    <>
      <PageHeader title={t.plan.title} sub={t.plan.sub} />
      <PlanBoard nodes={(nodes ?? []) as PNode[]} items={(items ?? []) as PItem[]} />
    </>
  );
}
