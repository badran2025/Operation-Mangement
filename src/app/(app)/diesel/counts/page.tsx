import { redirect } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { PageHeader, Panel } from "@/components/app/blocks";
import type { SteamMachineRow } from "../load";
import { CountsForm } from "./CountsForm";

export const dynamic = "force-dynamic";

const todayRiyadh = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

/** Daily counts per steam machine: dryer cycles, pressed pieces, hours of other steam machines. */
export default async function CountsPage({ searchParams }: { searchParams: Promise<{ branch?: string; date?: string }> }) {
  const { supabase, profile } = await requireActive();
  if (!["admin", "supervisor"].includes(profile.role)) redirect("/");
  const { t, locale } = await getT();
  const sp = await searchParams;
  const today = todayRiyadh();
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;

  const [{ data: branches }, { data: mach }] = await Promise.all([
    supabase.from("branches").select("id, name_ar, name_en").neq("status", "closed").order("city_id").order("sort"),
    supabase.from("equipment").select("id, branch_id, name, code, steam_type, steam_kg_h, cycle_minutes, status, steam_count_by").not("steam_type", "is", null).neq("status", "retired").order("steam_type").order("code"),
  ]);
  const machines = (mach ?? []) as SteamMachineRow[];
  const withSteam = new Set(machines.map((m) => m.branch_id));
  const opts = (branches ?? []).filter((b) => withSteam.has(b.id)).map((b) => ({ id: b.id, name: pick(locale, b.name_ar, b.name_en) }));
  const branchId = sp.branch ? Number(sp.branch) : opts.length === 1 ? opts[0].id : null;
  const mine = machines.filter((m) => m.branch_id === branchId);

  // the last 14 days, to see which days are missing
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - 13 * 86400000).toISOString().slice(0, 10);
  const { data: counts } = branchId
    ? await supabase.from("steam_counts").select("equipment_id, day, units, meter_reading").eq("branch_id", branchId).gte("day", start).lte("day", day)
    : { data: [] as { equipment_id: number; day: string; units: number | null; meter_reading: number | null }[] };
  // the last hour-meter reading before this day, for each metered machine
  const metered = mine.filter((m) => m.steam_count_by === "meter").map((m) => m.id);
  const { data: prevRows } = metered.length
    ? await supabase.from("steam_counts").select("equipment_id, day, meter_reading").in("equipment_id", metered).lt("day", day).not("meter_reading", "is", null).order("day", { ascending: false }).limit(200)
    : { data: [] as { equipment_id: number; day: string; meter_reading: number }[] };
  const prev = Object.fromEntries(metered.map((id) => { const r = (prevRows ?? []).find((x) => x.equipment_id === id); return [id, r ? { day: r.day, reading: Number(r.meter_reading) } : null]; }));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader back={{ href: branchId ? `/diesel/${branchId}` : "/diesel", label: t.diesel.title }} title={t.diesel.steam.countsTitle} sub={t.diesel.steam.countsSub} />
      <Panel className="mt-6">
        <CountsForm branches={opts} branchId={branchId} day={day} today={today} machines={mine} counts={(counts ?? []).map((c) => ({ ...c, units: c.units === null ? null : Number(c.units), meter_reading: c.meter_reading === null ? null : Number(c.meter_reading) }))} start={start} prev={prev} />
      </Panel>
    </div>
  );
}
