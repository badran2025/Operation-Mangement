import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronDownIcon, FuelIcon, GaugeIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { formatDateTime, nf, timeAgo } from "@/lib/i18n/format";
import { dailyUse, type Dip, type Tank } from "@/lib/diesel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyNote, Kpi, PageHeader, Panel } from "@/components/app/blocks";
import { DeliveriesTable, type Refuel } from "../DeliveriesTable";
import { AddTank, CalibrationEditor, TankForm } from "../TankEditors";

export const dynamic = "force-dynamic";

/** Everything about one branch's diesel: tanks and their measurements, stock and use, every delivery, every level check. */
export default async function BranchDieselPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, profile } = await requireActive();
  if (!["admin", "supervisor"].includes(profile.role)) redirect("/");
  const { t, locale } = await getT();
  const D = t.diesel;
  const n = nf(locale);
  const isAdmin = profile.role === "admin";
  const one = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en", { maximumFractionDigits: 1 });
  const L = (v: number | null | undefined) => (v === null || v === undefined ? "—" : one.format(Number(v)));

  const [{ data: branch }, { data: tankData }, { data: pts }, { data: dips }, { data: refs }, { data: checks }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en").eq("id", id).maybeSingle(),
    supabase.from("v_diesel_tanks").select("*").eq("branch_id", id).order("sort"),
    supabase.from("diesel_tank_points").select("tank_id, level_cm, liters"),
    supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, kind").eq("branch_id", id).gte("read_at", new Date(Date.now() - 31 * 86400000).toISOString()),
    supabase.from("diesel_refuels").select("*, profiles(full_name), diesel_refuel_files(file_path)").eq("branch_id", id).order("refuel_date", { ascending: false }).order("id", { ascending: false }).limit(100),
    supabase.from("diesel_dips").select("id, tank_id, read_at, level_cm, liters, notes, profiles(full_name)").eq("branch_id", id).eq("kind", "check").order("read_at", { ascending: false }).limit(50),
  ]);
  if (!branch) notFound();
  const name = pick(locale, branch.name_ar, branch.name_en);
  const tanks = (tankData ?? []) as Tank[];
  const active = tanks.filter((x) => x.active);
  const tankName = new Map(tanks.map((x) => [x.id, x.label]));
  const stock = active.length && active.every((x) => x.last_liters !== null) ? active.reduce((s, x) => s + Number(x.last_liters), 0) : null;
  const cap = active.reduce((s, x) => s + Number(x.capacity_l ?? 0), 0);
  const use = dailyUse((dips ?? []) as Dip[]).get(id) ?? null;
  const refuels = (refs ?? []) as unknown as Refuel[];
  const paths = refuels.flatMap((r) => r.diesel_refuel_files.map((f) => f.file_path));
  const signed = paths.length ? (await supabase.storage.from("diesel-files").createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = new Map(signed.map((x) => [x.path, x.signedUrl]));

  return (
    <>
      <PageHeader back={{ href: "/diesel", label: D.title }} title={`${D.title}: ${name}`} sub={<Link href={`/branches/${id}`} className="text-primary hover:underline">{name}</Link>}>
        {active.length > 0 && <Button variant="outline" render={<Link href={`/diesel/check?branch=${id}`} />} nativeButton={false}><GaugeIcon data-icon="inline-start" />{D.recordCheck}</Button>}
        {active.length > 0 && <Button render={<Link href={`/diesel/refuel?branch=${id}`} />} nativeButton={false}><FuelIcon data-icon="inline-start" />{D.recordRefuel}</Button>}
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={D.table.stock} value={stock === null ? "—" : `${L(stock)} L`} highlight />
        <Kpi label={D.tanks.capacity} value={`${L(cap)} L`} />
        <Kpi label={D.table.use} value={use ? D.perDay(L(use)) : "—"} />
        <Kpi label={D.table.daysLeft} value={stock !== null && use ? D.days(n(Math.floor(stock / use))) : "—"} tone={stock !== null && use && stock / use <= 3 ? "danger" : undefined} />
      </section>

      <Panel title={D.tanks.title} action={isAdmin && <AddTank branchId={id} />}>
        {tanks.length === 0 ? <EmptyNote>{D.noTanks}</EmptyNote> : (
          <ul className="flex flex-col gap-2">
            {tanks.map((tk) => {
              const dims = tk.shape === "horizontal_cylinder" ? `⌀${L(tk.diameter_cm)} × ${L(tk.length_cm)}` : tk.shape === "box" ? `${L(tk.length_cm)} × ${L(tk.width_cm)} × ${L(tk.height_cm)}` : `⌀${L(tk.diameter_cm)} × ${L(tk.height_cm)}`;
              const head = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold" dir="auto">{tk.label}</span>
                    <span className="block text-[13px] text-ink-muted">{D.tanks.shapes[tk.shape]} · <span className="num">{dims}</span> cm</span>
                  </span>
                  <span className="text-[13px]">
                    <b className="num font-semibold">{L(tk.capacity_l)} L</b>
                    <span className="block text-ink-muted">{Number(tk.calibration_points) ? D.tanks.byTable : tk.liters_per_cm ? `${L(tk.liters_per_cm)} ${D.tanks.perCm}` : D.tanks.varies}</span>
                  </span>
                  <span className="text-[13px]">
                    {tk.last_liters !== null ? <><b className="num font-semibold">{L(tk.last_liters)} L</b><span className="block text-ink-muted">{L(tk.last_cm)} cm · {timeAgo(t, tk.last_read_at)}</span></> : <span className="text-ink-muted">{D.noReading}</span>}
                  </span>
                  {!tk.active ? <Badge variant="neutral">{t.branchesTab.materials.notInUse}</Badge> : tk.confirmed ? <Badge variant="success">{D.tanks.confirmed}</Badge> : null}
                </>
              );
              return (
                <li key={tk.id}>
                  {isAdmin ? (
                    <details className="group rounded-[14px] bg-canvas">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-2 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                        {head}<ChevronDownIcon className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
                      </summary>
                      <div className="flex flex-col gap-5 border-t border-hairline px-3.5 py-4">
                        <TankForm branchId={id} tank={tk} />
                        <CalibrationEditor tankId={tk.id} points={(pts ?? []).filter((p) => p.tank_id === tk.id)} />
                      </div>
                    </details>
                  ) : <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[14px] bg-canvas px-3.5 py-3">{head}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title={D.recent}>
        {refuels.length === 0 ? <EmptyNote>{D.noDeliveries}</EmptyNote>
          : <DeliveriesTable t={t} locale={locale} refuels={refuels} photoUrl={(p) => url.get(p) ?? undefined} canDelete={isAdmin} />}
      </Panel>

      <Panel title={D.readings}>
        {(checks ?? []).length === 0 ? <EmptyNote>{D.noReadings}</EmptyNote> : (
          <ul className="flex flex-col gap-1.5">
            {(checks ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[14px] bg-canvas px-3.5 py-2.5 text-sm">
                <span className="num font-medium">{formatDateTime(locale, c.read_at)}</span>
                <span dir="auto">{tankName.get(c.tank_id)}</span>
                <span className="num text-ink-muted">{L(c.level_cm)} cm</span>
                <b className="num font-semibold">{L(c.liters)} L</b>
                <span className="ms-auto text-[13px] text-ink-muted" dir="auto">{(c.profiles as unknown as { full_name: string } | null)?.full_name}</span>
                {c.notes && <span className="w-full text-[13px] text-ink-muted" dir="auto">{c.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
