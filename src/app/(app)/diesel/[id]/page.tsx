import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronDownIcon, FuelIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { formatDate, timeAgo } from "@/lib/i18n/format";
import { branchDiesel, type Dip, type Tank } from "@/lib/diesel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyNote, Kpi, PageHeader, Panel } from "@/components/app/blocks";
import { DeliveriesTable, type Refuel } from "../DeliveriesTable";
import { AddTank, BuildCalibration, CalibrationEditor, TankForm } from "../TankEditors";

export const dynamic = "force-dynamic";

/** Everything about one branch's diesel: tanks and their measurements, stock and use, every delivery, every level check. */
export default async function BranchDieselPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, profile } = await requireActive();
  if (!["admin", "supervisor"].includes(profile.role)) redirect("/");
  const { t, locale } = await getT();
  const D = t.diesel;
  const isAdmin = profile.role === "admin";
  const one = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en", { maximumFractionDigits: 1 });
  const L = (v: number | null | undefined) => (v === null || v === undefined ? "—" : one.format(Number(v)));

  const [{ data: branch }, { data: tankData }, { data: pts }, { data: dips }, { data: refs }, { data: allDips }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en").eq("id", id).maybeSingle(),
    supabase.from("v_diesel_tanks").select("*").eq("branch_id", id).order("sort"),
    supabase.from("diesel_tank_points").select("tank_id, level_cm, liters"),
    supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, level_cm, kind").eq("branch_id", id).gte("read_at", new Date(Date.now() - 120 * 86400000).toISOString()),
    supabase.from("diesel_refuels").select("*, profiles(full_name), diesel_refuel_files(file_path)").eq("branch_id", id).order("refuel_date", { ascending: false }).order("id", { ascending: false }).limit(100),
    supabase.from("diesel_dips").select("tank_id, refuel_id, kind, level_cm").eq("branch_id", id).not("refuel_id", "is", null),
  ]);
  if (!branch) notFound();
  const name = pick(locale, branch.name_ar, branch.name_en);
  const tanks = (tankData ?? []) as Tank[];
  const active = tanks.filter((x) => x.active);
  const refuels = (refs ?? []) as unknown as Refuel[];
  const st = branchDiesel(tanks, (dips ?? []) as Dip[], refuels, id);
  const nextIn = st.next !== null ? Math.round((st.next - Date.now()) / 86400000) : null;
  // per cm tank: deliveries that went into it alone (cm before → after, invoice litres)
  const segmentsFor = (tankId: number) => refuels.flatMap((r) => {
    const rd = (allDips ?? []).filter((d) => d.refuel_id === r.id);
    if (new Set(rd.map((d) => d.tank_id)).size !== 1 || rd[0]?.tank_id !== tankId) return [];
    const b = rd.find((d) => d.kind === "before"), a = rd.find((d) => d.kind === "after");
    return b && a ? [{ id: r.id, date: r.refuel_date, from: Number(b.level_cm), to: Number(a.level_cm), liters: Number(r.liters) }] : [];
  });
  const cmTanks = tanks.filter((x) => x.shape !== "box" && (!x.liters_known || Number(x.calibration_points) > 0));
  const paths = refuels.flatMap((r) => r.diesel_refuel_files.map((f) => f.file_path));
  const signed = paths.length ? (await supabase.storage.from("diesel-files").createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = new Map(signed.map((x) => [x.path, x.signedUrl]));

  return (
    <>
      <PageHeader back={{ href: "/diesel", label: D.title }} title={`${D.title}: ${name}`} sub={<Link href={`/branches/${id}`} className="text-primary hover:underline">{name}</Link>}>
        {active.length > 0 && <Button render={<Link href={`/diesel/refuel?branch=${id}`} />} nativeButton={false}><FuelIcon data-icon="inline-start" />{D.recordRefuel}</Button>}
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label={D.table.stock} value={st.stockNow === null ? "—" : `≈ ${L(st.stockNow)} L`} highlight />
        <Kpi label={D.tanks.capacity} value={st.cap ? `${L(st.cap)} L` : "—"} />
        <Kpi label={D.table.weekly} value={st.weekly ? `${L(st.weekly)} L` : "—"} />
        <Kpi label={D.table.monthly} value={st.monthly ? `${L(st.monthly)} L` : "—"} />
        <Kpi label={D.table.next} value={st.next !== null ? formatDate(locale, new Date(st.next).toISOString()) : "—"}
          tone={nextIn !== null && nextIn < 0 ? "danger" : nextIn !== null && nextIn <= 2 ? "warning" : undefined} />
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
                    {!tk.liters_known && <span className="block text-[13px] font-medium text-warning">{D.cmOnly}</span>}
                  </span>
                  <span className="text-[13px]">
                    <b className="num font-semibold">{tk.liters_known ? `${L(tk.capacity_l)} L` : "—"}</b>
                    <span className="block text-ink-muted">{Number(tk.calibration_points) ? D.tanks.byTable : tk.liters_per_cm ? `${L(tk.liters_per_cm)} ${D.tanks.perCm}` : D.tanks.varies}</span>
                  </span>
                  <span className="text-[13px]">
                    {tk.last_liters !== null ? <><b className="num font-semibold">{L(tk.last_liters)} L</b><span className="block text-ink-muted">{L(tk.last_cm)} cm · {timeAgo(t, tk.last_read_at)}</span></>
                      : tk.last_cm !== null ? <><b className="num font-semibold">{L(tk.last_cm)} cm</b><span className="block text-ink-muted">{timeAgo(t, tk.last_read_at)}</span></>
                      : <span className="text-ink-muted">{D.noReading}</span>}
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

      {cmTanks.map((tk) => {
        const segs = segmentsFor(tk.id);
        return (
          <Panel key={tk.id} title={`${D.tanks.fromDeliveries}: ${tk.label}`}>
            <p className="-mt-1 mb-3 text-sm text-ink-muted">{D.tanks.fromDeliveriesHint}</p>
            {segs.length === 0 ? <EmptyNote>{D.tanks.noSegments}</EmptyNote> : (
              <ul className="mb-4 flex flex-col gap-1.5">
                {segs.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[14px] bg-canvas px-3.5 py-2.5 text-sm">
                    <span className="num font-medium">{formatDate(locale, g.date)}</span>
                    <span className="num">{D.tanks.segment(L(g.from), L(g.to), L(g.liters), g.to > g.from ? L(g.liters / (g.to - g.from)) : "—")}</span>
                    {g.from === 0 && <Badge variant="info">0 cm</Badge>}
                  </li>
                ))}
              </ul>
            )}
            {isAdmin && segs.length > 0 && <BuildCalibration tankId={tk.id} />}
          </Panel>
        );
      })}
    </>
  );
}
