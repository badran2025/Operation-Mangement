import { redirect } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { NewTicketForm } from "./NewTicketForm";

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const { supabase, profile } = await requireActive();
  if (profile.role === "technician") redirect("/maintenance");
  const { branch } = await searchParams;
  const [{ data: branches }, { data: cats }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, cities(name_ar)").order("city_id").order("sort"),
    supabase.from("ticket_categories").select("id, name_ar").order("sort"),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="بلاغ صيانة جديد" back={{ href: "/maintenance", label: "الصيانة" }} />
      <NewTicketForm
        defaultBranch={branch ? Number(branch) : undefined}
        branches={(branches ?? []).map((b) => ({ id: b.id, name: `${(b.cities as unknown as { name_ar: string } | null)?.name_ar ?? ""} — ${b.name_ar}` }))}
        categories={(cats ?? []).map((c) => ({ id: c.id, name: c.name_ar }))}
      />
    </div>
  );
}
