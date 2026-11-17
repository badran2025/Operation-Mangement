import { ChevronDownIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { MATERIAL_CATEGORIES } from "@/lib/branch";
import { Badge } from "@/components/ui/badge";
import { EmptyNote, PageHeader, Panel } from "@/components/app/blocks";
import { AddMaterial, MaterialEditor, TextEditor, type MaterialRow } from "./Editors";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const { supabase, profile } = await requireActive();
  const { t } = await getT();
  const B = t.branchesTab;
  const M = B.materials;
  const isAdmin = profile.role === "admin";
  const [{ data: mats }, { data: texts }, { data: used }] = await Promise.all([
    supabase.from("materials").select("*").order("category").order("sort").order("name"),
    supabase.from("app_texts").select("key, body"),
    supabase.from("branch_materials").select("material_id"),
  ]);
  const usedIn = (id: number) => (used ?? []).filter((u) => u.material_id === id).length;
  const items = ((mats ?? []) as MaterialRow[]).filter((m) => isAdmin || m.active);
  const text = (k: string): string => (texts ?? []).find((x) => x.key === k)?.body ?? "";
  const photo = (p: string | null) => (p ? supabase.storage.from("material-photos").getPublicUrl(p).data.publicUrl : null);

  return (
    <>
      <PageHeader back={{ href: "/branches", label: t.nav.branches }} title={B.materialsList} sub={M.catalogSub} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title={M.howTo}>
          {isAdmin ? <TextEditor textKey="materials_how_to_order" value={text("materials_how_to_order")} placeholder={M.howToPh} label={M.howTo} />
            : text("materials_how_to_order") ? (
              <ol className="flex list-decimal flex-col gap-1 ps-5 marker:font-semibold marker:text-primary">
                {text("materials_how_to_order").split("\n").filter((l) => l.trim()).map((l, i) => <li key={i}><span dir="auto">{l}</span></li>)}
              </ol>
            ) : <p className="text-ink-muted">{M.noGuide}</p>}
        </Panel>
        <Panel title={M.policy}>
          {isAdmin ? <TextEditor textKey="materials_policy" value={text("materials_policy")} placeholder={M.policyPh} label={M.policy} />
            : text("materials_policy") ? <p className="user-text whitespace-pre-line" dir="auto">{text("materials_policy")}</p> : <p className="text-ink-muted">{M.noGuide}</p>}
        </Panel>
      </div>

      <Panel title={B.sections.materials} action={isAdmin && <AddMaterial />}>
        {items.length === 0 ? <EmptyNote>{M.empty}</EmptyNote> : (
          <div className="flex flex-col gap-5">
            {MATERIAL_CATEGORIES.filter((c) => items.some((m) => m.category === c)).map((c) => (
              <section key={c}>
                <h2 className="mb-2 text-sm font-semibold text-ink-muted">{M.categories[c]}</h2>
                <ul className="flex flex-col gap-2">
                  {items.filter((m) => m.category === c).map((m) => {
                    const src = photo(m.photo_path);
                    const row = (
                      <>
                        {src
                          // eslint-disable-next-line @next/next/no-img-element -- storage URL
                          ? <img src={src} alt="" width={48} height={48} loading="lazy" className="size-12 shrink-0 rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
                          : <span className="size-12 shrink-0 rounded-xl bg-surface-sunken" aria-hidden />}
                        <span className="min-w-0 flex-1">
                          <span className="user-text block truncate font-semibold" dir="auto">{m.name}</span>
                          <span className="block truncate text-[13px] text-ink-muted">
                            {m.unit && <span dir="auto">{m.unit}</span>}
                            {m.unit && m.odoo_ref && <span className="mx-1.5 text-hairline" aria-hidden>|</span>}
                            {m.odoo_ref && <span className="num" dir="ltr">{m.odoo_ref}</span>}
                            {(m.unit || m.odoo_ref) && <span className="mx-1.5 text-hairline" aria-hidden>|</span>}
                            {M.usedIn(String(usedIn(m.id)))}
                          </span>
                        </span>
                        {!m.active && <Badge variant="neutral">{M.notInUse}</Badge>}
                      </>
                    );
                    return (
                      <li key={m.id}>
                        {isAdmin ? (
                          <details className="group rounded-[14px] bg-canvas">
                            <summary className="flex cursor-pointer list-none items-center gap-3 p-2.5 [&::-webkit-details-marker]:hidden">
                              {row}<ChevronDownIcon className="size-4 shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
                            </summary>
                            <div className="border-t border-hairline p-4"><MaterialEditor item={m} photoUrl={src} /></div>
                          </details>
                        ) : <div className="flex items-center gap-3 rounded-[14px] bg-canvas p-2.5">{row}</div>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
