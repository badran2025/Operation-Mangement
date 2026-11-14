import { notFound } from "next/navigation";
import { FileIcon } from "lucide-react";
import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries";
import { dueInfo, duration, formatDateTime, OPEN_STATUSES, timeAgo } from "@/lib/i18n/format";
import { PRIORITIES, PRIORITY_TONE, STATUSES, STATUS_TONE, waNumber, type TicketRow } from "@/lib/tickets";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader, Panel } from "@/components/app/blocks";
import { assignAction, priorityAction, setStatusAction } from "../actions";
import { CommentBox, ReminderButton } from "./ClientBits";

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
    default: return "";
  }
}

function StatusButtons({ id, options }: { id: number; options: { status: string; label: string; variant?: "default" | "outline" | "destructive" }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <ActionForm key={o.status} action={setStatusAction.bind(null, id)}>
          <input type="hidden" name="status" value={o.status} />
          <SubmitButton variant={o.variant ?? "outline"}>{o.label}</SubmitButton>
        </ActionForm>
      ))}
    </div>
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
  const isManager = role === "admin" || role === "maintenance_manager";
  const isOpen = OPEN_STATUSES.includes(ticket.status);

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

  return (
    <>
      <PageHeader
        back={{ href: "/maintenance", label: M.title }}
        title={ticket.title}
        sub={<span>#{ticket.id}{t.common.comma}{branchName}{t.common.comma}{catName}{ticket.legacy_ref && <>{t.common.comma}{M.fromAirtable}</>}</span>}
      >
        {phone && isOpen && role !== "technician" && <ReminderButton ticketId={ticket.id} phone={phone} message={reminderMsg} />}
      </PageHeader>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_TONE[ticket.status]}>{M.status[ticket.status]}</Badge>
              <Badge variant={PRIORITY_TONE[ticket.priority]}>{M.priorityLabel}: {M.priority[ticket.priority]}</Badge>
              {ticket.stops_branch && <Badge variant="danger">{isOpen ? M.stopped : M.wasStopped}</Badge>}
              {due && <span className={due.late ? "font-semibold text-danger" : "text-ink-muted"}>{due.text}</span>}
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-[13px] text-ink-muted">{M.reportedBy}</dt><dd className="m-0" dir="auto">{ticket.reporter_display ?? "—"}<span className="text-ink-muted">{t.common.comma}{formatDateTime(locale, ticket.created_at)}</span></dd></div>
              <div><dt className="text-[13px] text-ink-muted">{M.technician}</dt><dd className="m-0" dir="auto">{ticket.assignee_display ?? <span className="text-warning">{M.nobody}</span>}</dd></div>
              <div><dt className="text-[13px] text-ink-muted">{M.due}</dt><dd className="m-0">{formatDateTime(locale, ticket.due_at)}</dd></div>
              {ticket.resolved_at && (
                <div><dt className="text-[13px] text-ink-muted">{M.timeToResolve}</dt><dd className="m-0">{duration(t, Math.round((new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / 60000))}</dd></div>
              )}
            </dl>
            {ticket.description && <p className="mt-4 whitespace-pre-line" dir="auto">{ticket.description}</p>}
            <Files list={filesFor(null)} />
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
                  {e.body && <p className="mt-1 whitespace-pre-line text-ink" dir="auto">{e.body}</p>}
                  <Files list={filesFor(e.id)} />
                </li>
              ))}
            </ol>
            <CommentBox ticketId={ticket.id} />
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {role === "technician" && ticket.assigned_to === user.id && isOpen && (
            <Panel title={M.updateStatus}>
              <StatusButtons id={ticket.id} options={[
                { status: "in_progress", label: M.started },
                { status: "waiting_parts", label: M.waitingParts },
                { status: "resolved", label: M.fixed, variant: "default" as const },
              ].filter((o) => o.status !== ticket.status)} />
            </Panel>
          )}

          {role === "supervisor" && ticket.status === "resolved" && (
            <Panel title={M.resolvedTitle} className="ring-2 ring-primary">
              <p className="mb-3 text-sm text-ink-muted">{M.resolvedBody}</p>
              <StatusButtons id={ticket.id} options={[
                { status: "closed", label: M.confirmClose, variant: "default" },
                { status: "in_progress", label: M.stillBroken, variant: "destructive" },
              ]} />
            </Panel>
          )}
          {role === "supervisor" && ticket.status === "closed" && (
            <StatusButtons id={ticket.id} options={[{ status: "in_progress", label: M.reopen, variant: "destructive" }]} />
          )}

          {isManager && (
            <>
              <Panel title={M.assignTitle}>
                <ActionForm action={assignAction.bind(null, ticket.id)} className="flex flex-col gap-4">
                  <Field>
                    <FieldLabel htmlFor="as-who">{M.technician}</FieldLabel>
                    <NativeSelect id="as-who" name="assigned_to" defaultValue={ticket.assigned_to ?? (ticket.assignee_display ? "external" : "")} className="w-full">
                      <NativeSelectOption value="">{M.nobody}</NativeSelectOption>
                      {(staff ?? []).map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.full_name}</NativeSelectOption>)}
                      <NativeSelectOption value="external">{M.externalTech}</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <Field><FieldLabel htmlFor="as-name">{M.externalName}</FieldLabel><Input id="as-name" name="assignee_name" defaultValue={ticket.assigned_to ? "" : ticket.assignee_display ?? ""} dir="auto" /></Field>
                  <Field><FieldLabel htmlFor="as-phone">{M.techWhatsapp}</FieldLabel><Input id="as-phone" name="assignee_phone" type="tel" inputMode="tel" defaultValue={ticket.assigned_to ? "" : ticket.assignee_contact ?? ""} dir="ltr" placeholder="05xxxxxxxx" /></Field>
                  <SubmitButton>{M.saveAssign}</SubmitButton>
                </ActionForm>
              </Panel>

              <Panel title={M.statusPriority}>
                <div className="flex flex-col gap-5">
                  <ActionForm action={setStatusAction.bind(null, ticket.id)} className="flex flex-col gap-3">
                    <Field>
                      <FieldLabel htmlFor="st">{M.updateStatus}</FieldLabel>
                      <NativeSelect id="st" name="status" defaultValue={ticket.status} className="w-full">
                        {STATUSES.map((k) => <NativeSelectOption key={k} value={k}>{M.status[k]}</NativeSelectOption>)}
                      </NativeSelect>
                    </Field>
                    <Input name="note" placeholder={M.note} aria-label={M.note} dir="auto" />
                    <SubmitButton variant="outline">{M.updateStatus}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={priorityAction.bind(null, ticket.id)} className="flex flex-col gap-3">
                    <Field>
                      <FieldLabel htmlFor="pr">{M.priorityLabel}</FieldLabel>
                      <NativeSelect id="pr" name="priority" defaultValue={ticket.priority} className="w-full">
                        {PRIORITIES.map((k) => <NativeSelectOption key={k} value={k}>{M.priority[k]}: {M.priorityHint[k]}</NativeSelectOption>)}
                      </NativeSelect>
                    </Field>
                    <SubmitButton variant="outline">{M.changePriority}</SubmitButton>
                  </ActionForm>
                </div>
              </Panel>
            </>
          )}
          {ticket.last_reminder_at && <p className="text-xs text-ink-muted">{M.lastReminder}: {timeAgo(t, ticket.last_reminder_at)}</p>}
        </div>
      </div>
    </>
  );
}
