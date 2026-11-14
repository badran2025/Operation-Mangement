import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPinIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { nf } from "@/lib/i18n/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyNote, PageHeader, Panel } from "@/components/app/blocks";

export const dynamic = "force-dynamic";

export default async function HousingPage() {
  const { supabase, profile } = await requireActive();
  if (!["admin", "supervisor"].includes(profile.role)) redirect("/");
  const { t, locale } = await getT();
  const n = nf(locale);
  const [{ data: housings }, { data: workers }, { data: branches }] = await Promise.all([
    supabase.from("housings").select("*").order("name"),
    supabase.from("v_workers_current").select("id, housing_id, branch_id, status").neq("status", "terminated"),
    supabase.from("branches").select("id, name_ar, name_en"),
  ]);
  const bName = new Map((branches ?? []).map((b) => [b.id, pick(locale, b.name_ar, b.name_en)]));
  const list = workers ?? [];
  const noHousing = list.filter((w) => !w.housing_id).length;

  return (
    <>
      <PageHeader title={t.housing.title} sub={t.housing.sub} />
      {noHousing > 0 && (
        <Alert className="border-0 bg-warning-soft text-warning">
          <AlertDescription className="font-medium text-warning">{t.housing.noHousingWarn(noHousing)}</AlertDescription>
        </Alert>
      )}
      {(housings ?? []).length === 0 ? <EmptyNote>{t.housing.empty}</EmptyNote> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(housings ?? []).map((h) => {
            const residents = list.filter((w) => w.housing_id === h.id);
            const byBranch = new Map<number, number>();
            residents.forEach((w) => w.branch_id && byBranch.set(w.branch_id, (byBranch.get(w.branch_id) ?? 0) + 1));
            return (
              <Panel key={h.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-semibold" dir="auto">{h.name}</h2>
                    {h.address && <p className="truncate text-sm text-ink-muted" dir="auto">{h.address}</p>}
                    {h.capacity && <Badge variant={residents.length > h.capacity ? "danger" : "neutral"} className="mt-1">{t.housing.capacity(h.capacity)}</Badge>}
                  </div>
                  <div className="flex shrink-0 flex-col items-center rounded-xl bg-surface-tint px-4 py-2 text-accent-foreground">
                    <span className="num text-[28px] font-semibold leading-none">{n(residents.length)}</span>
                    <span className="mt-1 text-xs font-medium">{t.housing.residents}</span>
                  </div>
                </div>
                {byBranch.size > 0 && (
                  <ul className="mt-4 flex flex-col gap-1.5">
                    {[...byBranch.entries()].map(([bid, c]) => (
                      <li key={bid}>
                        <Link href={`/branches/${bid}`} className="flex items-center justify-between rounded-[14px] bg-canvas px-3.5 py-2.5 text-sm transition-colors hover:bg-surface-sunken">
                          <span>{bName.get(bid)}</span><b className="num font-semibold">{n(c)}</b>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {h.map_url && (
                  <a href={h.map_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    <MapPinIcon className="size-4" aria-hidden />{t.common.map}
                  </a>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
