import Link from "next/link";
import { redirect } from "next/navigation";
import { FuelIcon, GaugeIcon, ImageIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { formatDate, nf, timeAgo, TZ } from "@/lib/i18n/format";
import { dailyUse, type Dip, type Tank } from "@/lib/diesel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyNote, Kpi, PageHeader, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { DeleteRefuel } from "./DeleteRefuel";

export const dynamic = "force-dynamic";

type Refuel = {
  id: number; branch_id: number; refuel_date: string; liters: number; received_liters: number | null; shortage_liters: number | null;
  supplier: string | null; price_per_liter: number | null; invoice_no: string | null; notes: string | null;
  profiles: { full_name: string } | null; diesel_refuel_files: { file_path: string }[];
};

export default async function DieselPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { supabase, profile } = await requireActive();
  if (!["admin", "supervisor"].includes(profile.role)) redirect("/");
  const { t, locale } = await getT();
  const D = t.diesel;
  const n = nf(locale);
  const one = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en", { maximumFractionDigits: 1 });
  const L = (v: number | null | undefined) => (v === null || v === undefined ? "—" : one.format(Number(v)));
  const sp = await searchParams;
  const since = new Date(Date.now() - 31 * 86400000).toISOString();
  const monthStart = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 8) + "01";

  const [{ data: branches }, { data: tankData }, { data: dipData }, { data: refuelData }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en").neq("status", "closed").order("city_id").order("sort"),
    supabase.from("v_diesel_tanks").select("*").eq("active", true).order("sort"),
    supabase.from("diesel_dips").select("id, tank_id, branch_id, read_at, liters, kind").gte("read_at", since),
    supabase.from("diesel_refuels").select("*, profiles(full_name), diesel_refuel_files(file_path)").order("refuel_date", { ascending: false }).order("id", { ascending: false }).limit(200),
  ]);
  const tanks = (tankData ?? []) as Tank[];
  const refuels = (refuelData ?? []) as unknown as Refuel[];
  const use = dailyUse((dipData ?? []) as Dip[]);
  const bName = new Map((branches ?? []).map((b) => [b.id, pick(locale, b.name_ar, b.name_en)]));
  const month = refuels.filter((r) => r.refuel_date >= monthStart);
  const cost = month.reduce((s, r) => s + (r.price_per_liter ? Number(r.liters) * Number(r.price_per_liter) : 0), 0);
  const shortage = month.reduce((s, r) => s + Number(r.shortage_liters ?? 0), 0);

  const rows = (branches ?? []).map((b) => {
    const mine = tanks.filter((x) => x.branch_id === b.id);
    const cap = mine.reduce((s, x) => s + Number(x.capacity_l ?? 0), 0);
    const read = mine.filter((x) => x.last_liters !== null);
    const stock = read.length === mine.length && mine.length ? read.reduce((s, x) => s + Number(x.last_liters), 0) : null;
    const lastRead = read.map((x) => x.last_read_at!).sort().at(-1) ?? null;
    const u = use.get(b.id) ?? null;
    const last = refuels.find((r) => r.branch_id === b.id);
    return { b, mine, cap, stock, lastRead, use: u, daysLeft: stock !== null && u ? Math.floor(stock / u) : null, last,
      short: month.filter((r) => r.branch_id === b.id).reduce((s, r) => s + Number(r.shortage_liters ?? 0), 0) };
  });
  const withTanks = rows.filter((r) => r.mine.length);
  const withoutTanks = rows.filter((r) => !r.mine.length);

  const paths = refuels.slice(0, 30).flatMap((r) => r.diesel_refuel_files.map((f) => f.file_path));
  const signed = paths.length ? (await supabase.storage.from("diesel-files").createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = new Map(signed.map((x) => [x.path, x.signedUrl]));

  return (
    <>
      <PageHeader title={D.title} sub={D.sub}>
        <Button variant="outline" render={<Link href="/diesel/check" />} nativeButton={false}><GaugeIcon data-icon="inline-start" />{D.recordCheck}</Button>
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
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-start text-[12.5px] text-ink-muted">
                {[D.table.branch, D.table.tanks, D.table.stock, D.table.use, D.table.daysLeft, D.table.lastDelivery, D.table.shortage].map((h, i) => (
                  <th key={h} className={cn("h-10 px-3 text-start font-semibold", i === 0 && "ps-4 md:ps-5")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withTanks.map((r) => {
                const pct = r.stock !== null && r.cap ? Math.round((r.stock / r.cap) * 100) : null;
                return (
                  <tr key={r.b.id} className="border-t border-hairline">
                    <td className="py-3 ps-4 pe-3 md:ps-5"><Link href={`/branches/${r.b.id}?s=diesel`} className="font-semibold text-primary hover:underline">{bName.get(r.b.id)}</Link></td>
                    <td className="px-3 text-ink-muted"><span className="num">{n(r.mine.length)}</span> · <span className="num">{L(r.cap)} L</span></td>
                    <td className="px-3">
                      {r.stock === null ? <span className="text-ink-muted">{D.noReading}</span> : (
                        <div className="flex min-w-[150px] flex-col gap-1">
                          <span className="num font-semibold">{L(r.stock)} L <span className="font-normal text-ink-muted">({pct}%)</span></span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"><span className={cn("block h-full rounded-full", (pct ?? 0) < 25 ? "bg-danger" : (pct ?? 0) < 50 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} /></span>
                          {r.lastRead && <span className="text-[12px] text-ink-muted">{D.readAgo(timeAgo(t, r.lastRead))}</span>}
                        </div>
                      )}
                    </td>
                    <td className="num px-3">{r.use ? D.perDay(L(r.use)) : "—"}</td>
                    <td className={cn("num px-3 font-semibold", r.daysLeft !== null && r.daysLeft <= 3 ? "text-danger" : r.daysLeft !== null && r.daysLeft <= 7 ? "text-warning" : "")}>{r.daysLeft !== null ? D.days(n(r.daysLeft)) : "—"}</td>
                    <td className="num px-3 text-ink-muted">{r.last ? formatDate(locale, r.last.refuel_date) : "—"}</td>
                    <td className="px-3">{r.short ? <Badge variant="danger">{D.shortageL(L(r.short))}</Badge> : <span className="text-ink-muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {withoutTanks.length > 0 && (
          <p className="mt-4 text-[13px] text-ink-muted">
            {D.noTanks}: {withoutTanks.map((r) => <Link key={r.b.id} href={`/branches/${r.b.id}?s=diesel`} className="me-2 hover:text-primary hover:underline">{bName.get(r.b.id)}</Link>)}
          </p>
        )}
      </Panel>

      <Panel title={D.recent}>
        {refuels.length === 0 ? <EmptyNote>{D.noDeliveries}</EmptyNote> : (
          <div className="-mx-4 overflow-x-auto md:-mx-5">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-[12.5px] text-ink-muted">
                  {[D.col.date, D.table.branch, D.col.ordered, D.col.received, D.col.diff, D.col.supplier, D.col.cost, D.col.by, D.files, ""].map((h, i) => (
                    <th key={i} className={cn("h-10 px-3 text-start font-semibold", i === 0 && "ps-4 md:ps-5")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {refuels.slice(0, 30).map((r) => {
                  const diff = r.received_liters !== null ? Number(r.received_liters) - Number(r.liters) : null;
                  return (
                    <tr key={r.id} className="border-t border-hairline align-top">
                      <td className="num py-3 ps-4 pe-3 md:ps-5">{formatDate(locale, r.refuel_date)}</td>
                      <td className="px-3 py-3 font-medium">{bName.get(r.branch_id) ?? "—"}</td>
                      <td className="num px-3 py-3">{L(r.liters)}</td>
                      <td className="num px-3 py-3">{L(r.received_liters)}</td>
                      <td className="px-3 py-3">{diff === null ? "—" : diff < 0 ? <Badge variant="danger">{D.shortageL(L(-diff))}</Badge> : <Badge variant="success">{diff > 0 ? `+${L(diff)}` : D.ok}</Badge>}</td>
                      <td className="px-3 py-3" dir="auto">{r.supplier ?? "—"}{r.invoice_no && <span className="num block text-[12px] text-ink-muted" dir="ltr">{r.invoice_no}</span>}</td>
                      <td className="num px-3 py-3">{r.price_per_liter ? L(Math.round(Number(r.liters) * Number(r.price_per_liter) * 100) / 100) : "—"}</td>
                      <td className="px-3 py-3" dir="auto">{r.profiles?.full_name ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span className="flex gap-1.5">
                          {r.diesel_refuel_files.map((f, i) => url.get(f.file_path) && (
                            <a key={i} href={url.get(f.file_path) ?? undefined} target="_blank" rel="noreferrer" className="inline-flex size-8 items-center justify-center rounded-lg bg-canvas text-primary hover:bg-surface-sunken" aria-label={`${D.files} ${i + 1}`}>
                              <ImageIcon className="size-4" aria-hidden />
                            </a>
                          ))}
                        </span>
                      </td>
                      <td className="px-3 py-3">{profile.role === "admin" && <DeleteRefuel id={r.id} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
