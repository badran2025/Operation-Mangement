import Link from "next/link";
import { redirect } from "next/navigation";
import { CylinderIcon, FuelIcon, GaugeIcon } from "lucide-react";
import { MonthFiguresButton, Overview } from "./Overview";
import { PeriodBar } from "./MonthNav";
import { BranchPerf } from "./BranchPerf";
import { BranchTanks } from "./BranchTanks";
import { ScopePicker } from "./ScopePicker";
import { Suppliers } from "./Suppliers";
import { DieselTabs, type DieselTab } from "./DieselTabs";
import { defaultMonth, loadPerformance } from "./perf";
import { aggregate, earliestMonth, parsePeriod, periodToQuery } from "./period";
import { TankShape } from "./TankShape";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { formatDate, nf, timeAgo, TZ } from "@/lib/i18n/format";
import { branchDiesel, type Dip, type Tank } from "@/lib/diesel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyNote, Kpi, PageHeader, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { DeliveriesTable, type Refuel } from "./DeliveriesTable";

export const dynamic = "force-dynamic";

export default async function DieselPage({ searchParams }: { searchParams: Promise<{ saved?: string; m?: string; tab?: string; b?: string; c?: string; p?: string; from?: string; to?: string }> }) {
  const { supabase, profile } = await requireActive();
  if (!["admin", "supervisor"].includes(profile.role)) redirect("/");
  const { t, locale } = await getT();
  const D = t.diesel;
  const n = nf(locale);
  const one = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en", { maximumFractionDigits: 1 });
  const L = (v: number | null | undefined) => (v === null || v === undefined ? "—" : one.format(Number(v)));
  const sp = await searchParams;
  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const monthStart = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 8) + "01";

  const [{ data: branches }, { data: tankData }, { data: dipData }, { data: refuelData }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en, city_id, power_source, status").order("city_id").order("sort"),
    supabase.from("v_diesel_tank_info").select("*").eq("active", true).order("sort"),
    supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, level_cm, kind").gte("read_at", since),
    supabase.from("diesel_refuels").select("*, profiles(full_name), diesel_refuel_files(file_path)").order("refuel_date", { ascending: false }).order("id", { ascending: false }).limit(400),
  ]);
  const tanks = (tankData ?? []) as Tank[];
  const { data: sups } = await supabase.from("diesel_suppliers").select("id, name, price_per_liter, active").order("name");
  const supplierPrice = Object.fromEntries((sups ?? []).filter((x) => x.price_per_liter !== null).map((x) => [x.id, Number(x.price_per_liter)]));
  const refuels = (refuelData ?? []) as unknown as Refuel[];
  const dips = (dipData ?? []) as Dip[];
  const allVisible = branches ?? [];
  const open = allVisible.filter((b) => b.status !== "closed");
  // what is shown: all branches, one city, or one branch
  const { data: cityRows } = await supabase.from("cities").select("id, name_ar, name_en").order("sort");
  const cityName = new Map((cityRows ?? []).map((c) => [c.id, pick(locale, c.name_ar, c.name_en)]));
  const tab: DieselTab = sp.tab === "tanks" ? "tanks" : sp.tab === "suppliers" && profile.role === "admin" ? "suppliers" : "perf";
  const [fallback, earliest] = await Promise.all([defaultMonth(supabase), earliestMonth(supabase)]);
  const period = parsePeriod(sp, fallback, earliest);
  const perf = await loadPerformance(supabase, period.to, period.months.length * 2);
  const agg = aggregate(perf, period);
  const periodQuery = periodToQuery(period);
  // names of every branch (a comparison may name a branch the viewer does not run); details only for the viewer's own
  const bName = new Map([...perf.names.values()].map((b) => [b.id, pick(locale, b.name_ar, b.name_en)]));
  const closed = new Set(perf.branches.filter((b) => b.closed).map((b) => b.id));
  // a closed branch is offered only for a period it worked in
  const workedIn = (id: number) => { const r = agg.rows.get(id); return !!r && (r.validPieces > 0 || r.deliveries > 0 || r.left.length > 0); };
  const pickable = allVisible.filter((b) => b.status !== "closed" || (closed.has(b.id) && workedIn(b.id)));
  const selBranch = pickable.find((b) => String(b.id) === sp.b) ?? null;
  const selCity = !selBranch && sp.c && cityName.has(Number(sp.c)) ? Number(sp.c) : null;
  const scopeIds = selBranch ? [selBranch.id] : selCity ? pickable.filter((b) => b.city_id === selCity).map((b) => b.id) : profile.role === "admin" ? null : pickable.map((b) => b.id);
  const inScope = (id: number) => !scopeIds || scopeIds.includes(id);
  const scopeQuery = selBranch ? `b=${selBranch.id}` : selCity ? `c=${selCity}` : "";
  const cities = (cityRows ?? []).map((c) => ({ id: c.id, name: cityName.get(c.id)!, branches: pickable.filter((b) => b.city_id === c.id).map((b) => ({ id: b.id, name: pick(locale, b.name_ar, b.name_en) + (closed.has(b.id) ? ` (${D.ov.closed})` : "") })) })).filter((c) => c.branches.length);
  const month = refuels.filter((r) => r.refuel_date >= monthStart && inScope(r.branch_id));
  const cost = month.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const shortage = month.reduce((s, r) => s + Number(r.shortage_liters ?? 0), 0);
  const now = Date.now();
  const dayMs = 86400000;
  const reviewCount = [...agg.rows.values()].filter((r) => inScope(r.branchId) && !r.estimated && ["risk", "watch"].includes(r.status)).length;

  const rows = open.filter((b) => inScope(b.id)).map((b) => {
    const mine = tanks.filter((x) => x.branch_id === b.id);
    const mineRefuels = refuels.filter((r) => r.branch_id === b.id);
    const st = branchDiesel(mine, dips, mineRefuels, b.id, now);
    const m = month.filter((r) => r.branch_id === b.id);
    const mLitres = m.reduce((s, r) => s + Number(r.received_liters ?? r.liters), 0);
    const mInvoiceL = m.filter((r) => r.total_amount !== null).reduce((s, r) => s + Number(r.liters), 0);
    const mCost = m.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    return { b, mine, st, mLitres, mCost, mPrice: mInvoiceL ? mCost / mInvoiceL : null, mShort: m.reduce((s, r) => s + Number(r.shortage_liters ?? 0), 0), mCount: m.length };
  });
  const withTanks = rows.filter((r) => r.mine.some((x) => x.active));
  const withoutTanks = rows.filter((r) => !r.mine.some((x) => x.active));
  const price = (v: number | null) => (v === null ? "—" : new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(v));

  const shownRefuels = refuels.filter((r) => inScope(r.branch_id)).slice(0, 30);
  const paths = shownRefuels.flatMap((r) => r.diesel_refuel_files.map((f) => f.file_path));
  const signed = paths.length ? (await supabase.storage.from("diesel-files").createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = new Map(signed.map((x) => [x.path, x.signedUrl]));

  return (
    <>
      <PageHeader title={D.title} sub={D.sub}>
        <Button variant="outline" render={<Link href={selBranch ? `/diesel/check?branch=${selBranch.id}` : "/diesel/check"} />} nativeButton={false}><GaugeIcon data-icon="inline-start" />{D.perf.reading}</Button>
        <Button render={<Link href={selBranch ? `/diesel/refuel?branch=${selBranch.id}` : "/diesel/refuel"} />} nativeButton={false}><FuelIcon data-icon="inline-start" />{D.recordRefuel}</Button>
      </PageHeader>
      {sp.saved && <p role="status" className="rounded-[14px] bg-success-soft px-4 py-3 text-sm font-semibold text-success">✓ {D.form.saved}</p>}

      <DieselTabs t={t} base="/diesel" tab={tab} query={[scopeQuery, periodQuery].filter(Boolean).join("&")} reviewCount={reviewCount}
        suppliers={profile.role === "admin"} branchName={selBranch ? pick(locale, selBranch.name_ar, selBranch.name_en) : undefined} cityName={selCity ? cityName.get(selCity) : undefined} />

      {tab !== "suppliers" && (
        <PeriodBar t={t} locale={locale} period={tab === "perf" ? period : undefined} base={scopeQuery ? `/diesel?${scopeQuery}` : "/diesel"}
          scope={<ScopePicker cities={cities} value={selBranch ? `b:${selBranch.id}` : selCity ? `c:${selCity}` : ""} />}
          action={tab === "perf" && profile.role === "admin" && <MonthFiguresButton t={t} month={period.to} />} />
      )}

      {tab === "perf" && (selBranch
        ? (agg.rows.has(selBranch.id)
          ? <BranchPerf t={t} locale={locale} perf={perf} agg={agg} period={period} branchId={selBranch.id} names={bName} />
          : <EmptyNote>{D.perf.electric}</EmptyNote>)
        : <Overview t={t} locale={locale} agg={agg} period={period} names={bName} query={periodQuery}
            scope={scopeIds ?? undefined} scopeName={selCity ? cityName.get(selCity) : undefined} closed={closed} />)}

      {tab === "tanks" && selBranch && <BranchTanks supabase={supabase} t={t} locale={locale} id={selBranch.id} isAdmin={profile.role === "admin"} />}

      {tab === "tanks" && !selBranch && <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={D.kpi.received} value={L(month.reduce((s, r) => s + Number(r.received_liters ?? 0), 0))} highlight />
        <Kpi label={D.kpi.cost} value={cost ? L(Math.round(cost)) : "—"} />
        <Kpi label={D.kpi.shortage} value={L(shortage)} tone={shortage ? "danger" : undefined} />
        <Kpi label={D.kpi.deliveries} value={n(month.length)} />
      </section>

      <section aria-label={D.table.branch} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {withTanks.map(({ b, st, mLitres, mCost, mPrice, mShort, mCount }) => {
          const pct = st.stockNow !== null && st.cap ? Math.round((st.stockNow / st.cap) * 100) : null;
          const nextIn = st.next !== null ? Math.round((st.next - now) / dayMs) : null;
          const stat = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
            <div className="min-w-0 rounded-xl bg-canvas px-2.5 py-2">
              <dt className="text-[12px] leading-4 text-ink-muted">{label}</dt>
              <dd className="num m-0 truncate text-[14px] font-semibold">{value}</dd>
              {sub ? <dd className="num m-0 truncate text-[12px] text-ink-muted">{sub}</dd> : null}
            </div>
          );
          return (
            <article key={b.id} className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(27,34,53,0.04)]">
              <header className="flex items-center gap-3">
                <Link href={`/diesel?b=${b.id}&tab=tanks`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl hover:text-primary">
                  <span className="flex shrink-0 -space-x-3 rtl:space-x-reverse">
                    {st.active.slice(0, 2).map((x) => <TankShape key={x.id} shape={x.shape} className="h-11 w-14 rounded-lg bg-canvas" />)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold">{bName.get(b.id)}</span>
                    <span className="block text-[12.5px] text-ink-muted">
                      {D.tanksN(n(st.active.length))}{st.cap ? <> · <span className="num">{L(st.cap)} L</span></> : null}
                    </span>
                  </span>
                </Link>
                {st.stale && <Badge variant="secondary">{D.needsReading}</Badge>}
                {nextIn !== null && nextIn <= 2 && <Badge variant={nextIn < 0 ? "danger" : "warning"}>{nextIn < 0 ? D.overdueBy(n(-nextIn)) : nextIn === 0 ? D.today : D.inDays(n(nextIn))}</Badge>}
              </header>

              <div title={D.estimate}>
                {st.stale ? (
                  <p className="m-0 rounded-xl bg-surface-sunken px-3 py-2 text-[13px] text-ink-muted">
                    <b className="font-semibold">{D.needsReading}</b> – {D.staleLine(L(st.stockAt), timeAgo(t, new Date(st.lastAt!).toISOString()))}
                  </p>
                ) : st.stockNow !== null ? (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] text-ink-muted">{D.table.stock}</span>
                      <span className="num text-[20px] font-semibold">≈ {L(st.stockNow)} L <span className="text-sm font-normal text-ink-muted">({pct}%)</span></span>
                    </div>
                    <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-sunken"><span className={cn("block h-full rounded-full", (pct ?? 0) < 25 ? "bg-danger" : (pct ?? 0) < 50 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} /></span>
                    {st.lastAt && <span className="mt-1 block text-[12px] text-ink-muted">{D.readAgo(timeAgo(t, new Date(st.lastAt).toISOString()))}</span>}
                  </>
                ) : st.cmOnly.some((c) => c.lastCm !== null) ? (
                  <span className="text-[13px]">{st.cmOnly.map((c) => <span key={c.tank.id} className="block">{D.lastCm(L(c.lastCm))}</span>)}</span>
                ) : <span className="text-[13px] text-ink-muted">{D.table.stock}: {D.noReading}</span>}
              </div>

              <dl className="m-0 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-2 2xl:grid-cols-3">
                {stat(D.table.weekly, st.weekly ? `${L(st.weekly)} L` : "—")}
                {stat(D.table.monthly, st.monthly ? `${L(st.monthly)} L` : "—")}
                {stat(D.table.avgPrice, price(mPrice))}
                {stat(D.table.lastDelivery, st.last ? formatDate(locale, st.last.refuel_date) : "—", st.last ? `${L(st.last.liters)} L` : null)}
                {stat(D.table.next, st.next !== null ? formatDate(locale, new Date(st.next).toISOString()) : "—")}
                {stat(D.table.month, mCount ? `${L(mLitres)} L` : "—", mCost ? `${L(Math.round(mCost))} SAR` : null)}
              </dl>
              {mShort ? <Badge variant="danger" className="self-start">{D.table.shortage}: {D.shortageL(L(mShort))}</Badge> : null}

              <footer className="mt-auto flex flex-wrap gap-2 border-t border-hairline pt-3">
                <Button size="sm" render={<Link href={`/diesel/refuel?branch=${b.id}`} />} nativeButton={false}><FuelIcon data-icon="inline-start" />{D.recordRefuel}</Button>
                <Button size="sm" variant="outline" render={<Link href={`/diesel?b=${b.id}&tab=tanks`} />} nativeButton={false}><CylinderIcon data-icon="inline-start" />{D.card.open}</Button>
              </footer>
            </article>
          );
        })}
      </section>
      {withoutTanks.length > 0 && (
        <Panel title={D.card.noTanksTitle}>
          <p className="-mt-1 mb-3 text-sm text-ink-muted">{D.card.noTanksHint}</p>
          <div className="flex flex-wrap gap-2">
            {withoutTanks.map((r) => <Button key={r.b.id} size="sm" variant="outline" render={<Link href={`/diesel?b=${r.b.id}&tab=tanks`} />} nativeButton={false}>{bName.get(r.b.id)}</Button>)}
          </div>
        </Panel>
      )}

      <Panel title={D.recent}>
        {shownRefuels.length === 0 ? <EmptyNote>{D.noDeliveries}</EmptyNote> : (
          <DeliveriesTable t={t} locale={locale} refuels={shownRefuels} branchName={(id) => bName.get(id)} photoUrl={(p) => url.get(p) ?? undefined} canDelete={profile.role === "admin"} supplierPrice={supplierPrice} />
        )}
      </Panel>

      </>}
      {tab === "suppliers" && (
        <Panel title={D.sup.title}>
          <p className="-mt-1 mb-3 text-sm text-ink-muted">{D.sup.sub}</p>
          <Suppliers list={(sups ?? []).map((x) => ({ id: x.id, name: x.name, price_per_liter: x.price_per_liter === null ? null : Number(x.price_per_liter), active: x.active, deliveries: refuels.filter((r) => r.supplier_id === x.id).length }))} />
        </Panel>
      )}
    </>
  );
}
