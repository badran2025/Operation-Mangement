import { redirect } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { PageHeader, Panel } from "@/components/app/blocks";
import { NewTicketForm } from "./NewTicketForm";

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ branch?: string; equipment?: string }> }) {
  const { supabase, profile } = await requireActive();
  if (profile.role === "technician") redirect("/maintenance");
  const { t, locale } = await getT();
  const { branch, equipment } = await searchParams;
  const [{ data: branches }, { data: cats }, { data: machines }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en, cities(name_ar, name_en)").neq("status", "closed").order("city_id").order("sort"),
    supabase.from("ticket_categories").select("id, name_ar, name_en").order("sort"),
    supabase.from("equipment").select("id, branch_id, name, code, category_id").neq("status", "retired").order("name"),
  ]);
  type NameAr = { name_ar: string; name_en: string } | null;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={t.maintenance.newTicket} back={{ href: "/maintenance", label: t.maintenance.title }} />
      <Panel className="mt-6">
        <NewTicketForm
          defaultBranch={branch ? Number(branch) : undefined}
          defaultEquipment={equipment ? Number(equipment) : undefined}
          machines={(machines ?? []).map((m) => ({ id: m.id, branchId: m.branch_id, name: `${m.code} · ${m.name}`, code: m.code, categoryId: m.category_id }))}
          branches={(branches ?? []).map((b) => {
            const c = b.cities as unknown as NameAr;
            return { id: b.id, name: `${pick(locale, c?.name_ar, c?.name_en)}: ${pick(locale, b.name_ar, b.name_en)}` };
          })}
          categories={(cats ?? []).map((c) => ({ id: c.id, name: pick(locale, c.name_ar, c.name_en) }))}
        />
      </Panel>
    </div>
  );
}
