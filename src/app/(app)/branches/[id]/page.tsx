import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDownIcon, ExternalLinkIcon, FileIcon, MapPinIcon, PlusIcon, PrinterIcon, WrenchIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries";
import { ACTIVE_STATUSES, daysUntil, dueInfo, formatDate, formatDay, formatTime, nf } from "@/lib/i18n/format";
import { CORE_FILE_KINDS, EQUIPMENT_TONE, FILE_KINDS, fileState, MATERIAL_CATEGORIES } from "@/lib/branch";
import type { WorkerRow } from "@/lib/types";
import { PRIORITY_TONE, STATUS_TONE, type TicketRow } from "@/lib/tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkersTable } from "@/components/app/WorkersTable";
import { EmptyNote, Kpi, PageHeader, Panel, RowChevron, SoftRow } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { AddEquipment, EquipmentEditor, FileEditor, InfoEditor, type EquipmentRow } from "./Editors";
import { AddBranchMaterial, BranchMaterialEditor } from "../materials/Editors";

export const dynamic = "force-dynamic";

const SECTIONS = ["info", "workers", "equipment", "materials", "files", "maintenance"] as const;
type Hours = { weekday: number; open_time: string | null; close_time: string | null; is_24h: boolean; is_closed: boolean };
type FileRow = { id: number; kind: string; title: string; number: string | null; expiry_date: string | null; notes: string | null; file_path: string | null; mime_type: string | null };
type Material = { id: number; name: string; category: string; unit: string | null; odoo_ref: string | null; photo_path: string | null; active: boolean };

function hoursLines(t: Dict, hours: Hours[]): string[] {
  if (hours.length === 0) return ["—"];
  const fmt = (h: Hours) => (h.is_24h ? t.branch.open24 : h.is_closed ? t.branch.closed : `${formatTime(t, h.open_time)} – ${formatTime(t, h.close_time)}`);
  const groups = new Map<string, number[]>();
  for (const h of hours) groups.set(fmt(h), [...(groups.get(fmt(h)) ?? []), h.weekday]);
  if (groups.size === 1 && hours.length === 7) return [`${t.branch.daily}: ${[...groups.keys()][0]}`];
  return [...groups.entries()].map(([v, days]) => `${days.map((d) => t.weekdays[d]).join(t.common.comma)}: ${v}`);
}

export default async function BranchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string; edit?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const section = (SECTIONS as readonly string[]).includes(sp.s ?? "") ? sp.s! : "info";
  const { supabase, profile } = await requireActive();
  const { t, locale } = await getT();
  const B = t.branchesTab;
  const n = nf(locale);
  const role = profile.role;
  const isAdmin = role === "admin";
  const canEditEquipment = isAdmin || role === "maintenance_manager";

  const [{ data: branch }, { data: hours }, { data: workers }, { data: tix }, { data: eqData }, { data: fileData }] = await Promise.all([
    supabase.from("branches").select("*, cities(name_ar, name_en)").eq("id", id).maybeSingle(),
    supabase.from("branch_hours").select("*").eq("branch_id", id).order("weekday"),
    supabase.from("v_workers_current").select("*").eq("branch_id", id).order("full_name"),
    supabase.from("v_tickets").select("*").eq("branch_id", id).in("status", ACTIVE_STATUSES).order("due_at"),
    supabase.from("equipment").select("*").eq("branch_id", id).order("name"),
    supabase.from("branch_files").select("id, kind, title, number, expiry_date, notes, file_path, mime_type").eq("branch_id", id).order("created_at"),
  ]);
  if (!branch) notFound();
  const list = (workers ?? []) as WorkerRow[];
  const openTickets = (tix ?? []) as TicketRow[];
  const equipment = (eqData ?? []) as EquipmentRow[];
  const files = (fileData ?? []) as FileRow[];
  const city = branch.cities as { name_ar: string; name_en: string } | null;
  const active = list.filter((w) => w.status === "active");
  const offToday = active.filter((w) => w.off_today).length;
  const overdue = openTickets.filter((k) => k.overdue).length;
  const broken = equipment.filter((e) => e.status === "needs_repair" || e.status === "stopped").length;
  const fileAlerts = files.filter((f) => ["expired", "soon"].includes(fileState(f.expiry_date))).length;
  const name = pick(locale, branch.name_ar, branch.name_en);
  const otherName = locale === "ar" ? branch.name_en : branch.name_ar;
  const counts: Record<string, number | undefined> = { workers: list.length, equipment: equipment.length, files: files.length, maintenance: openTickets.length };
  const alerts: Record<string, boolean> = { equipment: broken > 0, files: fileAlerts > 0, maintenance: overdue > 0 };

  return (
    <>
      <PageHeader
        back={{ href: "/branches", label: t.nav.branches }}
        title={name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span>{pick(locale, city?.name_ar, city?.name_en)}</span><span className="text-hairline" aria-hidden>|</span>
            <span lang={locale === "ar" ? "en" : "ar"}>{otherName}</span>
            {branch.status !== "active" && <Badge variant="danger">{B.status[branch.status]}</Badge>}
          </span>
        }
      >
        {branch.map_url && (
          <Button variant="outline" render={<a href={branch.map_url} target="_blank" rel="noreferrer" />} nativeButton={false}><MapPinIcon data-icon="inline-start" />{t.common.map}</Button>
        )}
        {role !== "technician" && (
          <Button variant="outline" render={<Link href={`/maintenance/new?branch=${id}`} />} nativeButton={false}><WrenchIcon data-icon="inline-start" />{t.branch.reportIssue}</Button>
        )}
        {isAdmin && <Button render={<Link href={`/workers/new?branch=${id}`} />} nativeButton={false}><PlusIcon data-icon="inline-start" />{t.branch.addWorker}</Button>}
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label={name}>
        <Kpi label={t.dashboard.workers} value={n(list.filter((w) => w.status !== "terminated").length)} highlight href={`/branches/${id}?s=workers`} />
        <Kpi label={t.dashboard.workingToday} value={n(active.length - offToday)} href={`/branches/${id}?s=workers`} />
        <Kpi label={t.dashboard.openTickets} value={n(openTickets.length)} href={`/branches/${id}?s=maintenance`} />
        <Kpi label={t.dashboard.overdue} value={n(overdue)} tone={overdue ? "danger" : undefined} href={`/maintenance?tab=overdue&branch=${id}`} />
        <Kpi label={B.equipment.kpi} value={n(broken)} tone={broken ? "warning" : undefined} href={`/branches/${id}?s=equipment`} />
        <Kpi label={B.card.filesKpi} value={n(fileAlerts)} tone={fileAlerts ? "warning" : undefined} href={`/branches/${id}?s=files`} />
      </section>

      <nav aria-label={name} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-surface p-1">
        {SECTIONS.map((k) => (
          <Link key={k} href={`/branches/${id}?s=${k}`} scroll={false} aria-current={section === k ? "page" : undefined}
            className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150", section === k ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink")}>
            {B.sections[k]}
            {counts[k] !== undefined && <span className="num opacity-75">{n(counts[k])}</span>}
            {alerts[k] && <span className={cn("size-2 rounded-full", section === k ? "bg-white" : "bg-danger")} aria-hidden />}
          </Link>
        ))}
      </nav>

      {section === "info" && (
        <Panel>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <dt className="text-[13px] font-medium text-ink-muted">{t.branch.hours}</dt>
              {hoursLines(t, (hours ?? []) as Hours[]).map((l) => <dd key={l} className="m-0">{l}</dd>)}
              {branch.hours_note && <dd className="m-0 mt-1 text-[13px] text-warning" dir="auto">{branch.hours_note}</dd>}
            </div>
            <div>
              <dt className="text-[13px] font-medium text-ink-muted">{t.branch.ppm}</dt>
              <dd className="m-0">{branch.ppm_weekday !== null ? t.branch.ppmAt(t.weekdays[branch.ppm_weekday], formatTime(t, branch.ppm_time)) : t.common.notSet}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-medium text-ink-muted">{t.branch.contact}</dt>
              <dd className="m-0">{branch.phone ? <a href={`tel:${branch.phone}`} dir="ltr" className="text-primary hover:underline">{branch.phone}</a> : "—"}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-medium text-ink-muted">{B.info.address}</dt>
              <dd className="m-0">
                {branch.map_url ? (
                  <a href={branch.map_url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 text-primary hover:underline">
                    <MapPinIcon className="mt-1 size-4 shrink-0" aria-hidden /><span dir="auto">{branch.address ?? B.info.openMap}</span>
                  </a>
                ) : <span dir="auto">{branch.address ?? "—"}</span>}
              </dd>
            </div>
            {branch.notes && (
              <div className="sm:col-span-2">
                <dt className="text-[13px] font-medium text-ink-muted">{B.info.notes}</dt>
                <dd className="m-0 whitespace-pre-line" dir="auto">{branch.notes}</dd>
              </div>
            )}
          </dl>
          {isAdmin && (
            <div className="mt-5 border-t border-hairline pt-5">
              <InfoEditor branch={branch} hours={(hours ?? []) as Hours[]} startOpen={sp.edit === "1"} />
            </div>
          )}
        </Panel>
      )}

      {section === "workers" && (
        <Panel title={`${t.branch.workersTitle} (${n(list.length)})`}>
          {list.length === 0 ? <EmptyNote>{t.branch.noWorkers}</EmptyNote> : <WorkersTable t={t} locale={locale} workers={list} linkNames={isAdmin} />}
        </Panel>
      )}

      {section === "equipment" && <EquipmentSection id={id} equipment={equipment} canEdit={canEditEquipment} />}
      {section === "materials" && <MaterialsSection isAdmin={isAdmin} />}
      {section === "files" && <FilesSection id={id} files={files} isAdmin={isAdmin} />}

      {section === "maintenance" && (
        <Panel title={t.branch.openTicketsTitle} action={<Link href={`/maintenance?tab=all&branch=${id}`} className="text-sm font-medium text-primary hover:underline">{t.branch.allBranchTickets}</Link>}>
          {openTickets.length === 0 ? <EmptyNote>{t.maintenance.empty}</EmptyNote> : (
            <ul className="flex flex-col gap-1.5">
              {openTickets.map((k) => {
                const due = dueInfo(t, k.due_at, k.status);
                return (
                  <li key={k.id}>
                    <SoftRow href={`/maintenance/${k.id}`}>
                      <span className="min-w-0 flex-1">
                        <span className="user-text block truncate font-medium" dir="auto">{k.title}</span>
                        <span className="block truncate text-[13px] text-ink-muted">
                          {k.equipment_name && <span dir="auto">{k.equipment_name}{t.common.comma}</span>}
                          {k.assignee_display ? <span dir="auto">{k.assignee_display}</span> : <span className="text-warning">{t.maintenance.nobody}</span>}
                          {due && <span className={cn(due.late && "font-semibold text-danger")}>{t.common.comma}{due.text}</span>}
                        </span>
                      </span>
                      {(k.priority === "urgent" || k.priority === "high") && <Badge variant={PRIORITY_TONE[k.priority]}>{t.maintenance.priority[k.priority]}</Badge>}
                      <Badge variant={STATUS_TONE[k.status] ?? "neutral"}>{t.maintenance.status[k.status]}</Badge>
                      <RowChevron />
                    </SoftRow>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </>
  );

  // ---------- sections ----------
  async function EquipmentSection({ id, equipment, canEdit }: { id: number; equipment: EquipmentRow[]; canEdit: boolean }) {
    const E = B.equipment;
    const [{ data: cats }, { data: allBranches }, { data: hist }] = await Promise.all([
      supabase.from("ticket_categories").select("id, name_ar, name_en").order("sort"),
      canEdit ? supabase.from("branches").select("id, name_ar, name_en").order("city_id").order("sort") : Promise.resolve({ data: [] as { id: number; name_ar: string; name_en: string }[] }),
      supabase.from("v_tickets").select("id, title, status, created_at, equipment_id").eq("branch_id", id).not("equipment_id", "is", null).order("created_at", { ascending: false }),
    ]);
    const catName = new Map((cats ?? []).map((c) => [c.id, pick(locale, c.name_ar, c.name_en)]));
    const catOpts = (cats ?? []).map((c) => ({ id: c.id, name: pick(locale, c.name_ar, c.name_en) }));
    const brOpts = (allBranches ?? []).map((b) => ({ id: b.id, name: pick(locale, b.name_ar, b.name_en) }));
    // grouped by type, in the order of the type list; machines in natural order (Washer 2 before Washer 10)
    const order = new Map((cats ?? []).map((c, i) => [c.id, i]));
    const groups = [...new Set(equipment.map((e) => e.category_id))]
      .sort((a, b) => (a === null ? 1 : b === null ? -1 : (order.get(a) ?? 0) - (order.get(b) ?? 0)))
      .map((cid) => [cid, equipment.filter((e) => e.category_id === cid).sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }))] as const);
    return (
      <Panel title={B.sections.equipment} action={
        <div className="flex flex-wrap gap-2">
          {equipment.length > 0 && <Button variant="outline" render={<Link href={`/branches/${id}/labels`} />} nativeButton={false}><PrinterIcon data-icon="inline-start" />{E.labels}</Button>}
          {canEdit && <AddEquipment branchId={id} branches={brOpts} categories={catOpts} />}
        </div>
      }>
        <p className="-mt-1 mb-4 text-sm text-ink-muted">{E.sub}</p>
        {equipment.length === 0 ? <EmptyNote>{E.empty}</EmptyNote> : (
          <div className="flex flex-col gap-2">
            {groups.map(([cid, items]) => {
              const down = items.filter((e) => e.status === "needs_repair" || e.status === "stopped").length;
              return (
              <details key={cid ?? "none"} className="group/g rounded-2xl border border-hairline">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  <ChevronDownIcon className="size-4 text-ink-muted transition-transform duration-150 group-open/g:rotate-180" aria-hidden />
                  <span>{cid ? catName.get(cid) : t.maintenance.category}</span><span className="num font-normal text-ink-muted">{n(items.reduce((s, e) => s + e.quantity, 0))}</span>
                  <span className="ms-auto">{down > 0 ? <Badge variant="warning">{E.notWorking(n(down))}</Badge> : <Badge variant="success">{E.allWorking}</Badge>}</span>
                </summary>
                <ul className="flex flex-col gap-2 px-2 pb-2">
            {items.map((e) => {
              const mine = (hist ?? []).filter((h) => h.equipment_id === e.id);
              const open = mine.filter((h) => ACTIVE_STATUSES.includes(h.status)).length;
              const w = daysUntil(e.warranty_until);
              return (
                <li key={e.id}>
                  <details className="group rounded-[14px] bg-canvas">
                    <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3.5 py-3 sm:grid-cols-[110px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] [&::-webkit-details-marker]:hidden">
                      <span className="num hidden rounded-lg bg-surface px-2 py-1 text-center text-[13px] font-bold tracking-wide sm:block" dir="ltr">{e.code}</span>
                      <span className="min-w-0">
                        <span className="block truncate"><span className="num me-2 text-[12.5px] font-bold sm:hidden" dir="ltr">{e.code}</span><span className="user-text font-semibold" dir="auto">{e.name}</span>{e.quantity > 1 && <span className="num ms-1.5 font-normal text-ink-muted">×{n(e.quantity)}</span>}</span>
                        {e.notes && <span className={cn("block truncate text-[13px]", e.status === "working" ? "text-ink-muted" : "text-warning")} dir="auto">{e.notes}</span>}
                      </span>
                      <span className="hidden min-w-0 text-[13px] sm:block">
                        <span className="block truncate" dir="auto">{[e.brand, e.model].filter(Boolean).join(" ") || "—"}</span>
                        {e.serial_no && <span className="num block truncate text-ink-muted" dir="ltr">{e.serial_no}</span>}
                      </span>
                      <span className="hidden text-[13px] text-ink-muted sm:block">
                        {e.warranty_until ? (w !== null && w < 0 ? E.warrantyOver : E.warrantyTo(formatDate(locale, e.warranty_until))) : "—"}
                        {open > 0 && <span className="block font-semibold text-danger">{E.openTickets(n(open))}</span>}
                      </span>
                      <Badge variant={EQUIPMENT_TONE[e.status]}>{E.statuses[e.status]}</Badge>
                      <ChevronDownIcon className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="flex flex-col gap-4 border-t border-hairline px-3.5 py-4">
                      <h3 className="text-sm font-semibold">{E.history}</h3>
                      {mine.length === 0 ? <p className="text-sm text-ink-muted">{E.noHistory}</p> : (
                        <ul className="flex flex-col gap-1">
                          {mine.map((h) => (
                            <li key={h.id}>
                              <Link href={`/maintenance/${h.id}`} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm hover:bg-surface-sunken">
                                <span className="num text-ink-muted">#{h.id}</span>
                                <span className="user-text min-w-0 flex-1 truncate" dir="auto">{h.title}</span>
                                <span className="num text-[13px] text-ink-muted">{formatDay(locale, h.created_at)}</span>
                                <Badge variant={STATUS_TONE[h.status]}>{t.maintenance.status[h.status]}</Badge>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      {canEdit && <EquipmentEditor item={e} branchId={id} branches={brOpts} categories={catOpts} />}
                    </div>
                  </details>
                </li>
              );
            })}
                </ul>
              </details>
              );
            })}
          </div>
        )}
      </Panel>
    );
  }

  async function MaterialsSection({ isAdmin }: { isAdmin: boolean }) {
    const M = B.materials;
    const [{ data: mine }, { data: all }, { data: texts }] = await Promise.all([
      supabase.from("branch_materials").select("material_id, min_qty, max_qty, notes, materials(id, name, category, unit, odoo_ref, photo_path, active)").eq("branch_id", id),
      isAdmin ? supabase.from("materials").select("id, name, category").eq("active", true).order("name") : Promise.resolve({ data: [] as { id: number; name: string; category: string }[] }),
      supabase.from("app_texts").select("key, body"),
    ]);
    const text = (k: string): string | null => (texts ?? []).find((x) => x.key === k)?.body ?? null;
    type Row = { material_id: number; min_qty: number | null; max_qty: number | null; notes: string | null; materials: Material | null };
    const items = ((mine ?? []) as unknown as Row[]).filter((r) => r.materials).sort((x, y) => x.materials!.name.localeCompare(y.materials!.name));
    const photo = (p: string | null) => (p ? supabase.storage.from("material-photos").getPublicUrl(p).data.publicUrl : null);
    const assigned = new Set(items.map((r) => r.material_id));
    const howTo = text("materials_how_to_order");
    return (
      <>
        <Panel title={B.sections.materials} action={<Link href="/branches/materials" className="text-sm font-medium text-primary hover:underline">{B.materialsList}</Link>}>
          <p className="-mt-1 mb-4 text-sm text-ink-muted">{M.branchSub}</p>
          {isAdmin && (
            <div className="mb-4">
              <AddBranchMaterial branchId={id} options={(all ?? []).filter((m) => !assigned.has(m.id)).map((m) => ({ id: m.id, name: m.name }))} />
              <p className="mt-2 text-[13px] text-ink-muted">{M.notListed} <Link href="/branches/materials" className="font-medium text-primary hover:underline">{B.materialsList}</Link></p>
            </div>
          )}
          {items.length === 0 ? <EmptyNote>{M.branchEmpty}</EmptyNote> : (
            <div className="flex flex-col gap-5">
              {MATERIAL_CATEGORIES.filter((c) => items.some((r) => r.materials!.category === c)).map((c) => (
                <section key={c}>
                  <h3 className="mb-2 text-sm font-semibold text-ink-muted">{M.categories[c]}</h3>
                  <ul className="flex flex-col gap-2">
                    {items.filter((r) => r.materials!.category === c).map((r) => {
                      const m = r.materials!;
                      const src = photo(m.photo_path);
                      const head = (
                        <>
                          {src
                            // eslint-disable-next-line @next/next/no-img-element -- storage URL
                            ? <img src={src} alt="" width={56} height={56} loading="lazy" className="size-14 shrink-0 rounded-xl bg-surface object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
                            : <span className="size-14 shrink-0 rounded-xl bg-surface-sunken" aria-hidden />}
                          <span className="min-w-0 flex-1">
                            <span className="user-text block truncate font-semibold" dir="auto">{m.name}</span>
                            <span className="block text-[13px] text-ink-muted">
                              {M.min} <b className="num font-semibold text-ink">{r.min_qty ?? "—"}</b>
                              <span className="mx-1.5 text-hairline" aria-hidden>|</span>
                              {M.max} <b className="num font-semibold text-ink">{r.max_qty ?? "—"}</b>
                              {m.unit && <span dir="auto"> {m.unit}</span>}
                              {m.odoo_ref && <><span className="mx-1.5 text-hairline" aria-hidden>|</span><span className="num" dir="ltr">{m.odoo_ref}</span></>}
                            </span>
                            {r.notes && <span className="block truncate text-[13px] text-ink-muted" dir="auto">{r.notes}</span>}
                          </span>
                        </>
                      );
                      return (
                        <li key={r.material_id}>
                          {isAdmin ? (
                            <details className="group rounded-[14px] bg-canvas">
                              <summary className="flex cursor-pointer list-none items-center gap-3 p-2.5 [&::-webkit-details-marker]:hidden">
                                {head}<ChevronDownIcon className="size-4 shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
                              </summary>
                              <div className="border-t border-hairline p-4"><BranchMaterialEditor branchId={id} materialId={r.material_id} min={r.min_qty} max={r.max_qty} notes={r.notes} /></div>
                            </details>
                          ) : <div className="flex items-center gap-3 rounded-[14px] bg-canvas p-2.5">{head}</div>}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Panel>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title={M.howTo}>
            {howTo ? (
              <ol className="flex list-decimal flex-col gap-1 ps-5 marker:font-semibold marker:text-primary">
                {howTo.split("\n").filter((l) => l.trim()).map((l, i) => <li key={i}><span dir="auto">{l}</span></li>)}
              </ol>
            ) : <p className="text-ink-muted">{M.noGuide}</p>}
          </Panel>
          <Panel title={M.policy}>
            {text("materials_policy") ? <p className="user-text whitespace-pre-line" dir="auto">{text("materials_policy")}</p> : <p className="text-ink-muted">{M.noGuide}</p>}
          </Panel>
        </div>
      </>
    );
  }

  async function FilesSection({ id, files, isAdmin }: { id: number; files: FileRow[]; isAdmin: boolean }) {
    const F = B.files;
    const paths = files.map((f) => f.file_path).filter(Boolean) as string[];
    const signed = paths.length ? (await supabase.storage.from("branch-files").createSignedUrls(paths, 3600)).data ?? [] : [];
    const url = new Map(signed.map((x) => [x.path, x.signedUrl]));
    const extra = files.filter((f) => !(CORE_FILE_KINDS as readonly string[]).includes(f.kind));
    const rows: { kind: string; file?: FileRow }[] = [
      ...CORE_FILE_KINDS.flatMap((k) => {
        const mine = files.filter((f) => f.kind === k);
        return mine.length ? mine.map((f) => ({ kind: k, file: f })) : [{ kind: k }];
      }),
      ...extra.map((f) => ({ kind: f.kind, file: f })),
    ];
    const state = (f?: FileRow) => {
      if (!f) return <Badge variant="neutral">{F.missing}</Badge>;
      const d = daysUntil(f.expiry_date);
      if (d === null) return <Badge variant="neutral">{F.noExpiry}</Badge>;
      if (d < 0) return <Badge variant="danger">{t.time.expiredDays(-d)}</Badge>;
      return <Badge variant={fileState(f.expiry_date) === "soon" ? "warning" : "success"}>{t.time.daysLeft(d)}</Badge>;
    };
    return (
      <Panel title={B.sections.files}>
        <p className="-mt-1 mb-4 text-sm text-ink-muted">{F.sub}</p>
        <ul className="flex flex-col gap-2">
          {rows.map(({ kind, file }, i) => {
            const link = file?.file_path ? url.get(file.file_path) : null;
            const head = (
              <>
                <span className="min-w-0">
                  <span className="block truncate font-semibold" dir="auto">{file && ["other", "snag_list", "technical_report"].includes(kind) ? file.title : F.kinds[kind]}</span>
                  <span className="block truncate text-[13px] text-ink-muted">
                    {file?.number && <span className="num" dir="ltr">{file.number}</span>}
                    {file?.number && file?.expiry_date && <span className="mx-1.5 text-hairline" aria-hidden>|</span>}
                    {file?.expiry_date && <span className="num">{formatDate(locale, file.expiry_date)}</span>}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {link && (
                    <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                      {file?.mime_type === "application/pdf" ? <FileIcon className="size-3.5" aria-hidden /> : <ExternalLinkIcon className="size-3.5" aria-hidden />}{F.view}
                    </a>
                  )}
                  {state(file)}
                  {isAdmin && <ChevronDownIcon className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />}
                </span>
              </>
            );
            return (
              <li key={file?.id ?? `m-${kind}-${i}`}>
                {isAdmin ? (
                  <details className="group rounded-[14px] bg-canvas">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3.5 py-3 [&::-webkit-details-marker]:hidden">{head}</summary>
                    <div className="border-t border-hairline px-3.5 py-4">
                      <FileEditor branchId={id} kinds={[...FILE_KINDS]} file={file} defaultKind={file ? undefined : kind} />
                    </div>
                  </details>
                ) : <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-canvas px-3.5 py-3">{head}</div>}
              </li>
            );
          })}
        </ul>
        {isAdmin && (
          <details className="group mt-4 rounded-[14px] border border-dashed border-hairline">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden"><PlusIcon className="size-4" aria-hidden />{F.add}</summary>
            <div className="px-3.5 pb-4"><FileEditor branchId={id} kinds={["snag_list", "technical_report", "other", ...CORE_FILE_KINDS]} /></div>
          </details>
        )}
      </Panel>
    );
  }
}
