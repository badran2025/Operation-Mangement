import Link from "next/link";
import { redirect } from "next/navigation";
import { FuelIcon } from "lucide-react";
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

      <Panel>
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="text-[12.5px] text-ink-muted">
                {[D.table.branch, D.table.stock, D.table.weekly, D.table.monthly, D.table.lastDelivery, D.table.next, D.table.month, D.table.avgPrice, D.table.shortage].map((h, i) => (
                  <th key={h} className={cn("h-10 px-2.5 text-start font-semibold", i === 0 && "ps-4 md:ps-5")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withTanks.map(({ b, st, mLitres, mCost, mPrice, mShort, mCount }) => {
                const pct = st.stockNow !== null && st.cap ? Math.round((st.stockNow / st.cap) * 100) : null;
                const nextIn = st.next !== null ? Math.round((st.next - now) / dayMs) : null;
                return (
                  <tr key={b.id} className="border-t border-hairline align-top">
                    <td className="py-3 ps-4 pe-3 md:ps-5">
                      <Link href={`/diesel/${b.id}`} className="font-semibold text-primary hover:underline">{bName.get(b.id)}</Link>
                      <span className="block text-[12.5px] text-ink-muted">
                        {st.active.length > 1 && <>{D.tanksN(n(st.active.length))} · </>}{st.cap && st.active.some((x) => x.liters_known) ? <span className="num">{L(st.cap)} L</span> : null}
                        {st.active.some((x) => !x.liters_known) && <span className="block text-warning">{D.cmOnly}</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {st.stockNow !== null ? (
                        <div className="flex min-w-[140px] flex-col gap-1" title={D.estimate}>
                          <span className="num font-semibold">≈ {L(st.stockNow)} L <span className="font-normal text-ink-muted">({pct}%)</span></span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"><span className={cn("block h-full rounded-full", (pct ?? 0) < 25 ? "bg-danger" : (pct ?? 0) < 50 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} /></span>
                          {st.lastAt && <span className="text-[12px] text-ink-muted">{D.readAgo(timeAgo(t, new Date(st.lastAt).toISOString()))}</span>}
                        </div>
                      ) : st.cmOnly.some((c) => c.lastCm !== null) ? (
                        <span className="text-[13px]">{st.cmOnly.map((c) => <span key={c.tank.id} className="block">{D.lastCm(L(c.lastCm))}</span>)}</span>
                      ) : <span className="text-ink-muted">{D.noReading}</span>}
                    </td>
                    <td className="num px-3 py-3 font-semibold">{st.weekly ? `${L(st.weekly)} L` : "—"}</td>
                    <td className="num px-3 py-3 font-semibold">{st.monthly ? `${L(st.monthly)} L` : "—"}</td>
                    <td className="px-3 py-3">{st.last ? <><span className="num block">{formatDate(locale, st.last.refuel_date)}</span><span className="num text-[12.5px] text-ink-muted">{L(st.last.liters)} L</span></> : "—"}</td>
                    <td className="px-3 py-3">
                      {st.next !== null && nextIn !== null ? (
                        <>
                          <span className="num block">{formatDate(locale, new Date(st.next).toISOString())}</span>
                          <span className={cn("text-[12.5px] font-semibold", nextIn < 0 ? "text-danger" : nextIn <= 2 ? "text-warning" : "text-ink-muted")}>
                            {nextIn < 0 ? D.overdueBy(n(-nextIn)) : nextIn === 0 ? D.today : D.inDays(n(nextIn))}
                          </span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3">{mCount ? <><span className="num block">{L(mLitres)} L</span>{mCost ? <span className="num text-[12.5px] text-ink-muted">{L(Math.round(mCost))} SAR</span> : null}</> : "—"}</td>
                    <td className="num px-3 py-3">{price(mPrice)}</td>
                    <td className="px-3 py-3">{mShort ? <Badge variant="danger">{D.shortageL(L(mShort))}</Badge> : <span className="text-ink-muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {withoutTanks.length > 0 && (
          <p className="mt-4 text-[13px] text-ink-muted">
            {D.noTanks}: {withoutTanks.map((r) => <Link key={r.b.id} href={`/diesel/${r.b.id}`} className="me-2 hover:text-primary hover:underline">{bName.get(r.b.id)}</Link>)}
          </p>
        )}
      </Panel>

      <Panel title={D.recent}>
        {refuels.length === 0 ? <EmptyNote>{D.noDeliveries}</EmptyNote> : (
          <DeliveriesTable t={t} locale={locale} refuels={refuels.slice(0, 30)} branchName={(id) => bName.get(id)} photoUrl={(p) => url.get(p) ?? undefined} canDelete={profile.role === "admin"} />
        )}
      </Panel>
    </>
  );
}
