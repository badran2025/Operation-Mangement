import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, FileIcon, PauseIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries";
import { dueInfo, duration, formatDateTime, formatDay, OPEN_STATUSES, timeAgo } from "@/lib/i18n/format";
import { PRIORITY_TONE, STATUS_RANK, STATUS_TONE, waNumber, type TicketRow } from "@/lib/tickets";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { AssignForm, CommentBox, ReminderButton, StepButton, StopsBranchToggle } from "./ClientBits";

export const dynamic = "force-dynamic";

type Ev = { id: number; kind: string; body: string | null; from_value: string | null; to_value: string | null; created_at: string; profiles: { full_name: string } | null };
type Att = { id: number; event_id: number | null; file_path: string; mime_type: string | null };

function eventText(t: Dict, e: Ev): string {
  const M = t.maintenance;
  const st = (s: string | null) => (s ? M.status[s] ?? s : "");
  switch (e.kind) {
    case "created": return M.ev.created;
    case "status": return M.ev.status(st(e.from_value), st(e.to_value));
    case "assign": return e.to_value ? M.ev.assign(e.to_value) : M.ev.unassign;
    case "priority": return M.ev.priority(M.priority[e.to_value ?? ""] ?? e.to_value ?? "");
    case "reminder": return M.ev.reminder;
    case "parts": return M.ev.parts;
    case "stops_branch": return e.to_value === "on" ? M.ev.stopsOn : M.ev.stopsOff;
    default: return "";
  }
}

/** Where the ticket is in its life: milestones reached so far. */
function Steps({ t, locale, ticket }: { t: Dict; locale: "en" | "ar"; ticket: TicketRow }) {
  const F = t.maintenance.flow;
  const rank = STATUS_RANK[ticket.status];
  const hold = ticket.status === "waiting_parts";
  const steps = [
    { label: F.steps.reported, note: formatDay(locale, ticket.created_at) },
    { label: F.steps.assigned, note: ticket.assignee_display },
    { label: hold ? F.onHold : F.steps.work, note: null },
    { label: F.steps.fixed, note: ticket.resolved_at ? formatDay(locale, ticket.resolved_at) : null },
    { label: F.steps.closed, note: ticket.closed_at ? formatDay(locale, ticket.closed_at) : null },
  ];
  return (
    <ol className="grid grid-cols-5">
      {steps.map((s, i) => {
        const reached = i <= rank, current = i === rank;
        return (
          <li key={i} aria-current={current ? "step" : undefined} className="relative flex flex-col items-center gap-1.5 px-0.5 text-center">
            {i > 0 && <span className={cn("absolute end-1/2 top-[11px] h-0.5 w-full", reached ? "bg-primary" : "bg-hairline")} aria-hidden />}
            <span className={cn("relative z-10 flex size-6 items-center justify-center rounded-full",
              !reached && "bg-surface-sunken ring-2 ring-inset ring-hairline",
              reached && !current && "bg-primary text-primary-foreground",
              current && (hold ? "bg-warning text-surface ring-4 ring-warning-soft" : "bg-primary text-primary-foreground ring-4 ring-surface-tint"))}>
              {reached && (current && hold ? <PauseIcon className="size-3" aria-hidden /> : <CheckIcon className="size-3.5" aria-hidden />)}
            </span>
            <span className={cn("text-[12px] leading-tight sm:text-[13px]", current ? "font-semibold text-ink" : reached ? "text-ink" : "text-ink-muted")}>{s.label}</span>
            {reached && s.note && <span className="num hidden max-w-full truncate text-[12px] text-ink-muted sm:block" dir="auto">{s.note}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, profile, user } = await requireActive();
  const { t, locale } = await getT();
  const M = t.maintenance;
  const [{ data: tk }, { data: events }, { data: atts }] = await Promise.all([
    supabase.from("v_tickets").select("*").eq("id", id).maybeSingle(),
    supabase.from("ticket_events").select("id, kind, body, from_value, to_value, created_at, profiles!ticket_events_actor_fkey(full_name)").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_attachments").select("id, event_id, file_path, mime_type").eq("ticket_id", id).order("created_at"),
  ]);
  if (!tk) notFound();
  const ticket = tk as TicketRow;
  const [{ data: br }, { data: cat }] = await Promise.all([
    supabase.from("branches").select("name_ar, name_en").eq("id", ticket.branch_id).maybeSingle(),
    ticket.category_id ? supabase.from("ticket_categories").select("name_ar, name_en").eq("id", ticket.category_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const branchName = pick(locale, br?.name_ar, br?.name_en);
  const catName = cat ? pick(locale, cat.name_ar, cat.name_en) : "—";
  const role = profile.role;
  const F = M.flow;
  const st = ticket.status;
  const isManager = role === "admin" || role === "maintenance_manager";
  const canWork = isManager || (role === "technician" && ticket.assigned_to === user.id);
  const canConfirm = isManager || role === "supervisor";
  const isOpen = OPEN_STATUSES.includes(st);
  const tech = ticket.assignee_display ?? "";

  const attachments = (atts ?? []) as Att[];
  const signed = attachments.length
    ? (await supabase.storage.from("ticket-files").createSignedUrls(attachments.map((a) => a.file_path), 3600)).data ?? []
    : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const filesFor = (eventId: number | null) => attachments.filter((a) => a.event_id === eventId);

  const { data: staff } = isManager
    ? await supabase.from("profiles").select("id, full_name, role").eq("active", true).in("role", ["technician", "maintenance_manager", "admin"]).order("full_name")
    : { data: [] };

  const due = dueInfo(t, ticket.due_at, ticket.status);
  const phone = waNumber(ticket.assignee_contact);
  const siteUrl = process.env.URL ?? "https://kleen-operations.netlify.app";
  const reminderMsg = M.reminderMsg(ticket.id, branchName, ticket.title, due?.text ?? "", `${siteUrl}/maintenance/${ticket.id}`);

  const Files = ({ list }: { list: Att[] }) => list.length === 0 ? null : (
    <div className="mt-2 flex flex-wrap gap-2">
      {list.map((a) => {
        const u = urlOf.get(a.file_path);
        if (!u) return null;
        return a.mime_type?.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- private signed URLs, no optimizer
          <a key={a.id} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" width={96} height={96} loading="lazy" className="size-24 rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" /></a>
        ) : a.mime_type?.startsWith("video/") ? (
          <video key={a.id} src={u} controls preload="metadata" className="h-32 rounded-xl" />
        ) : (
          <a key={a.id} href={u} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-input px-4 text-sm"><FileIcon className="size-4" aria-hidden />{M.file}</a>
        );
      })}
    </div>
  );

  const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="min-w-0"><dt className="text-[13px] text-ink-muted">{label}</dt><dd className="m-0 font-medium">{children}</dd></div>
  );
  const assignForm = (submitLabel: string) => (
    <AssignForm ticketId={ticket.id} staff={(staff ?? []).map((s) => ({ id: s.id, name: s.full_name }))} priority={ticket.priority} submitLabel={submitLabel}
      current={{ userId: ticket.assigned_to, name: ticket.assignee_display, phone: ticket.assignee_contact }} />
  );

  return (
    <>
      <PageHeader
        back={{ href: "/maintenance", label: M.title }}
        title={ticket.title}
        sub={<span>#{ticket.id}{t.common.comma}{branchName}{t.common.comma}{catName}{ticket.equipment_name && <>{t.common.comma}<b className="num font-semibold" dir="ltr">{ticket.equipment_code}</b> {ticket.equipment_name}</>}{ticket.legacy_ref && <>{t.common.comma}{M.fromAirtable}</>}</span>}
      >
        {phone && isOpen && role !== "technician" && <ReminderButton ticketId={ticket.id} phone={phone} message={reminderMsg} />}
      </PageHeader>

      <Panel>
        {st === "cancelled" ? <p className="font-medium text-ink-muted">{F.cancelledNote}</p> : <Steps t={t} locale={locale} ticket={ticket} />}
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* what to do now comes first on a phone */}
        <div className="flex min-w-0 flex-col gap-6 xl:order-2">
          <Panel title={F.next} className={cn(((st === "new" && isManager) || (isOpen && st !== "new" && canWork) || (st === "resolved" && canConfirm)) && "ring-2 ring-primary")}>
            {st === "new" && (isManager ? <><p className="mb-4 text-sm text-ink-muted">{F.newManager}</p>{assignForm(F.assign)}</> : <p className="text-ink-muted">{F.newWaiting}</p>)}

            {st === "assigned" && (canWork ? (
              <>
                <p className="mb-3 text-sm text-ink-muted">{isManager ? F.assignedManager(tech) : F.assignedYou}</p>
                <div className="flex flex-wrap gap-2">
                  <StepButton ticketId={ticket.id} status="in_progress" label={F.start} variant="default" />
                  <StepButton ticketId={ticket.id} status="waiting_parts" label={F.hold} reasonPh={F.holdPh} />
                </div>
              </>
            ) : <p className="text-ink-muted">{F.assignedWaiting(tech)}</p>)}

            {st === "in_progress" && (canWork ? (
              <>
                <p className="mb-3 text-sm text-ink-muted">{F.progressAct}</p>
                <div className="flex flex-wrap gap-2">
                  <StepButton ticketId={ticket.id} status="resolved" label={F.fixed} variant="default" />
                  <StepButton ticketId={ticket.id} status="waiting_parts" label={F.hold} reasonPh={F.holdPh} />
                </div>
              </>
            ) : <p className="text-ink-muted">{F.progressWaiting(tech)}</p>)}

            {st === "waiting_parts" && (
              <>
                <div className="mb-3 rounded-[14px] bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
                  <div className="font-semibold">{F.holdReason}</div>
                  <div className="user-text" dir="auto">{ticket.hold_reason ?? "—"}</div>
                </div>
                {canWork ? (
                  <>
                    <p className="mb-3 text-sm text-ink-muted">{F.holdAct}</p>
                    <div className="flex flex-wrap gap-2">
                      <StepButton ticketId={ticket.id} status="in_progress" label={F.resume} variant="default" />
                      <StepButton ticketId={ticket.id} status="resolved" label={F.fixed} />
                    </div>
                  </>
                ) : <p className="text-ink-muted">{F.holdWaiting(tech)}</p>}
              </>
            )}

            {st === "resolved" && (canConfirm ? (
              <>
                <p className="mb-3 text-sm text-ink-muted">{F.resolvedConfirm(tech)}</p>
                <div className="flex flex-wrap gap-2">
                  <StepButton ticketId={ticket.id} status="closed" label={F.confirmClose} variant="default" />
                  <StepButton ticketId={ticket.id} status="in_progress" label={F.stillBroken} variant="destructive" reasonPh={F.brokenPh} />
                </div>
              </>
            ) : <p className="text-ink-muted">{F.resolvedWaiting}</p>)}

            {st === "closed" && (
              <>
                <p className={cn("text-sm text-ink-muted", canConfirm && "mb-3")}>{F.closedNote}</p>
                {canConfirm && <StepButton ticketId={ticket.id} status="in_progress" label={F.reopen} reasonPh={F.reopenPh} />}
              </>
            )}

            {st === "cancelled" && (isManager ? <StepButton ticketId={ticket.id} status="new" label={F.restore} /> : <p className="text-ink-muted">{F.cancelledNote}</p>)}
          </Panel>

          {isManager && st !== "closed" && st !== "cancelled" && (
            <details className="group rounded-2xl bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:px-5 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-[17px] font-semibold">{F.manage}</span>
                  <span className="block text-[13px] text-ink-muted">{F.manageHint}</span>
                </span>
                <ChevronDownIcon className="size-4 shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
              </summary>
              <div className="flex flex-col gap-5 px-4 pb-5 md:px-5">
                {st !== "new" && assignForm(F.saveChanges)}
                <StopsBranchToggle ticketId={ticket.id} on={ticket.stops_branch} />
                <StepButton ticketId={ticket.id} status="cancelled" label={F.cancel} variant="destructive" reasonPh={F.cancelPh} />
              </div>
            </details>
          )}
          {ticket.last_reminder_at && <p className="text-xs text-ink-muted">{M.lastReminder}: {timeAgo(t, ticket.last_reminder_at)}</p>}
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:order-1">
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_TONE[st]}>{M.status[st]}</Badge>
              <Badge variant={PRIORITY_TONE[ticket.priority]}>{M.priorityLabel}: {M.priority[ticket.priority]}</Badge>
              {ticket.stops_branch && <Badge variant="danger">{isOpen ? M.stopped : M.wasStopped}</Badge>}
              {due && <span className={due.late ? "font-semibold text-danger" : "text-ink-muted"}>{due.text}</span>}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm lg:grid-cols-4">
              <Item label={M.reportedBy}><span dir="auto">{ticket.reporter_display ?? "—"}</span><span className="block text-[13px] font-normal text-ink-muted">{formatDateTime(locale, ticket.created_at)}</span></Item>
              <Item label={M.technician}>
                {ticket.assignee_display ? <span dir="auto">{ticket.assignee_display}</span> : <span className="text-warning">{M.nobody}</span>}
                {ticket.assignee_contact && (
                  <span className="block text-[13px] font-normal">
                    <a href={`tel:${ticket.assignee_contact}`} dir="ltr" className="text-primary hover:underline">{ticket.assignee_contact}</a>
                  </span>
                )}
              </Item>
              <Item label={M.due}>{formatDateTime(locale, ticket.due_at)}<span className="block text-[13px] font-normal text-ink-muted">{F.target(M.priorityHint[ticket.priority])}</span></Item>
              <Item label={M.branch}><Link href={`/branches/${ticket.branch_id}`} className="text-primary hover:underline">{branchName}</Link><span className="block text-[13px] font-normal text-ink-muted">{catName}</span></Item>
              {ticket.resolved_at && (
                <Item label={M.timeToResolve}>{duration(t, Math.round((new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / 60000))}</Item>
              )}
            </dl>
            {(ticket.description || filesFor(null).length > 0) && (
              <div className="mt-4 border-t border-hairline pt-4">
                <h2 className="mb-1 text-[13px] text-ink-muted">{M.details}</h2>
                {ticket.description && <p className="user-text whitespace-pre-line" dir="auto">{ticket.description}</p>}
                <Files list={filesFor(null)} />
              </div>
            )}
          </Panel>

          <section className="flex flex-col gap-3">
            <h2 className="text-[17px] font-semibold">{M.timeline}</h2>
            <ol className="flex flex-col gap-2.5 border-s-2 border-hairline ps-4">
              {((events ?? []) as unknown as Ev[]).map((e) => (
                <li key={e.id} className="relative rounded-[14px] bg-surface p-3.5 text-sm">
                  <span className="absolute -start-[23px] top-4 size-3 rounded-full bg-primary ring-4 ring-canvas" aria-hidden />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span><b className="font-semibold" dir="auto">{e.profiles?.full_name ?? M.ev.system}</b> {eventText(t, e)}</span>
                    <time className="text-xs text-ink-muted" dateTime={e.created_at} title={formatDateTime(locale, e.created_at)}>{timeAgo(t, e.created_at)}</time>
                  </div>
                  {e.body && <p className="user-text mt-1 whitespace-pre-line text-ink" dir="auto">{e.body}</p>}
                  <Files list={filesFor(e.id)} />
                </li>
              ))}
            </ol>
            <CommentBox ticketId={ticket.id} />
          </section>
        </div>
      </div>
    </>
  );
}
