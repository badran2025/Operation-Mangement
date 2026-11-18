import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardListIcon, CylinderIcon, FuelIcon } from "lucide-react";
import { loadSteamMonth, monthOf } from "./load";
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

export default async function DieselPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
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
    supabase.from("branches").select("id, name_ar, name_en").neq("status", "closed").order("city_id").order("sort"),
    supabase.from("v_diesel_tank_info").select("*").eq("active", true).order("sort"),
    supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, level_cm, kind").gte("read_at", since),
    supabase.from("diesel_refuels").select("*, profiles(full_name), diesel_refuel_files(file_path)").order("refuel_date", { ascending: false }).order("id", { ascending: false }).limit(400),
  ]);
  const tanks = (tankData ?? []) as Tank[];
  const refuels = (refuelData ?? []) as unknown as Refuel[];
  const dips = (dipData ?? []) as Dip[];
  const bName = new Map((branches ?? []).map((b) => [b.id, pick(locale, b.name_ar, b.name_en)]));
  const month = refuels.filter((r) => r.refuel_date >= monthStart);
  const cost = month.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const shortage = month.reduce((s, r) => s + Number(r.shortage_liters ?? 0), 0);
  const now = Date.now();
  const dayMs = 86400000;

  const rows = (branches ?? []).map((b) => {
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
  const steam = await loadSteamMonth(supabase, withTanks.map((r) => r.b.id), monthOf(null));
  const sar = (v: number | null) => (v === null ? "—" : `${new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} SAR`);
  const withoutTanks = rows.filter((r) => !r.mine.some((x) => x.active));
  const price = (v: number | null) => (v === null ? "—" : new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(v));

  const paths = refuels.slice(0, 30).flatMap((r) => r.diesel_refuel_files.map((f) => f.file_path));
  const signed = paths.length ? (await supabase.storage.from("diesel-files").createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = new Map(signed.map((x) => [x.path, x.signedUrl]));

  return (
    <>
      <PageHeader title={D.title} sub={D.sub}>
        <Button render={<Link href="/diesel/refuel" />} nativeButton={false}><FuelIcon data-icon="inline-start" />{D.recordRefuel}</Button>
      </PageHeader>
      {sp.saved && <p role="status" className="rounded-[14px] bg-success-soft px-4 py-3 text-sm font-semibold text-success">✓ {D.form.saved}</p>}

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
                <Link href={`/diesel/${b.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl hover:text-primary">
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
                {nextIn !== null && nextIn <= 2 && <Badge variant={nextIn < 0 ? "danger" : "warning"}>{nextIn < 0 ? D.overdueBy(n(-nextIn)) : nextIn === 0 ? D.today : D.inDays(n(nextIn))}</Badge>}
              </header>

              <div title={D.estimate}>
                {st.stockNow !== null ? (
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
              {(steam.get(b.id)?.machines.length ?? 0) > 0 && (
                <dl className="m-0 grid grid-cols-2 gap-1.5">
                  {stat(D.steam.card.dryerCycle, sar(steam.get(b.id)!.dryerUnitCost))}
                  {stat(D.steam.card.pressPiece, sar(steam.get(b.id)!.pressUnitCost))}
                </dl>
              )}
              {mShort ? <Badge variant="danger" className="self-start">{D.table.shortage}: {D.shortageL(L(mShort))}</Badge> : null}

              <footer className="mt-auto flex flex-wrap gap-2 border-t border-hairline pt-3">
                <Button size="sm" render={<Link href={`/diesel/refuel?branch=${b.id}`} />} nativeButton={false}><FuelIcon data-icon="inline-start" />{D.recordRefuel}</Button>
                <Button size="sm" variant="outline" render={<Link href={`/diesel/${b.id}`} />} nativeButton={false}><CylinderIcon data-icon="inline-start" />{D.card.open}</Button>
                {(steam.get(b.id)?.machines.length ?? 0) > 0 && <Button size="sm" variant="outline" render={<Link href={`/diesel/counts?branch=${b.id}`} />} nativeButton={false}><ClipboardListIcon data-icon="inline-start" />{D.steam.card.counts}</Button>}
              </footer>
            </article>
          );
        })}
      </section>
      {withoutTanks.length > 0 && (
        <Panel title={D.card.noTanksTitle}>
          <p className="-mt-1 mb-3 text-sm text-ink-muted">{D.card.noTanksHint}</p>
          <div className="flex flex-wrap gap-2">
            {withoutTanks.map((r) => <Button key={r.b.id} size="sm" variant="outline" render={<Link href={`/diesel/${r.b.id}`} />} nativeButton={false}>{bName.get(r.b.id)}</Button>)}
          </div>
        </Panel>
      )}

      <Panel title={D.recent}>
        {refuels.length === 0 ? <EmptyNote>{D.noDeliveries}</EmptyNote> : (
          <DeliveriesTable t={t} locale={locale} refuels={refuels.slice(0, 30)} branchName={(id) => bName.get(id)} photoUrl={(p) => url.get(p) ?? undefined} canDelete={profile.role === "admin"} />
        )}
      </Panel>
    </>
  );
}
