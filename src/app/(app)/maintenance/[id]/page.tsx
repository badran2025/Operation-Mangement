import { notFound } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { dueLabel, duration, formatDateTime, OPEN_STATUSES, PRIORITY, TICKET_STATUS, timeAgo, waNumber, type TicketRow } from "@/lib/tickets";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Field, PageHeader } from "@/components/ui";
import { assignAction, priorityAction, setStatusAction } from "../actions";
import { CommentBox, ReminderButton } from "./ClientBits";

export const dynamic = "force-dynamic";

type Ev = { id: number; kind: string; body: string | null; from_value: string | null; to_value: string | null; created_at: string; profiles: { full_name: string } | null };
type Att = { id: number; event_id: number | null; file_path: string; mime_type: string | null };

function eventText(e: Ev): string {
  const st = (s: string | null) => (s ? TICKET_STATUS[s]?.label ?? s : "");
  switch (e.kind) {
    case "created": return "فتح البلاغ";
    case "status": return `غيّر الحالة: ${st(e.from_value)} ← ${st(e.to_value)}`;
    case "assign": return e.to_value ? `حوّل البلاغ إلى ${e.to_value}` : "شال التحويل";
    case "priority": return `غيّر الأولوية إلى ${PRIORITY[e.to_value ?? ""]?.label ?? e.to_value}`;
    case "reminder": return "بعت تذكير للفني (واتساب)";
    case "parts": return "قطع غيار";
    default: return "";
  }
}

function StatusButtons({ id, options }: { id: number; options: { status: string; label: string; cls?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <ActionForm key={o.status} action={setStatusAction.bind(null, id)}>
          <input type="hidden" name="status" value={o.status} />
          <SubmitButton className={o.cls ?? "btn-ghost"}>{o.label}</SubmitButton>
        </ActionForm>
      ))}
    </div>
  );
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, profile, user } = await requireActive();
  const [{ data: t }, { data: events }, { data: atts }] = await Promise.all([
    supabase.from("v_tickets").select("*").eq("id", id).maybeSingle(),
    supabase.from("ticket_events").select("id, kind, body, from_value, to_value, created_at, profiles!ticket_events_actor_fkey(full_name)").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_attachments").select("id, event_id, file_path, mime_type").eq("ticket_id", id).order("created_at"),
  ]);
  if (!t) notFound();
  const ticket = t as TicketRow;
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

  const due = dueLabel(ticket);
  const phone = waNumber(ticket.assignee_contact);
  const siteUrl = process.env.URL ?? "https://kleen-operations.netlify.app";
  const reminderMsg = `تذكير بخصوص بلاغ صيانة #${ticket.id}\nالفرع: ${ticket.branch_ar}\nالمشكلة: ${ticket.title}\n${due ?? ""}\nبرجاء التحديث على الموقع: ${siteUrl}/maintenance/${ticket.id}`;

  const Files = ({ list }: { list: Att[] }) => list.length === 0 ? null : (
    <div className="mt-2 flex flex-wrap gap-2">
      {list.map((a) => {
        const u = urlOf.get(a.file_path);
        if (!u) return null;
        return a.mime_type?.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- private signed URLs, no optimizer
          <a key={a.id} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" /></a>
        ) : a.mime_type?.startsWith("video/") ? (
          <video key={a.id} src={u} controls className="h-32 rounded-lg border border-slate-200" />
        ) : (
          <a key={a.id} href={u} target="_blank" rel="noreferrer" className="btn-ghost">📄 ملف</a>
        );
      })}
    </div>
  );

  return (
    <>
      <PageHeader
        title={ticket.title}
        subtitle={<span>#{ticket.id} · {ticket.branch_ar} · {ticket.category_ar ?? "عام"}{ticket.legacy_ref && <> · منقول من Airtable</>}</span>}
        back={{ href: "/maintenance", label: "الصيانة" }}
      >
        {phone && isOpen && role !== "technician" && <ReminderButton ticketId={ticket.id} phone={phone} message={reminderMsg} />}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Badge tone={TICKET_STATUS[ticket.status].tone}>{TICKET_STATUS[ticket.status].label}</Badge>
              <Badge tone={PRIORITY[ticket.priority].tone}>أولوية {PRIORITY[ticket.priority].label}</Badge>
              {ticket.stops_branch && <Badge tone="red">{isOpen ? "الفرع متوقف" : "كان موقّف الفرع"}</Badge>}
              {due && <span className={`font-semibold ${ticket.overdue ? "text-red-600" : "text-slate-600"}`}>{due}</span>}
            </div>
            <div><span className="text-slate-500">البلاغ من:</span> {ticket.reporter_display ?? "—"} · {formatDateTime(ticket.created_at)}</div>
            <div><span className="text-slate-500">الفني المسؤول:</span> {ticket.assignee_display ?? <span className="text-amber-700">لسه محدش</span>}</div>
            <div><span className="text-slate-500">الموعد المطلوب:</span> {formatDateTime(ticket.due_at)}</div>
            {ticket.resolved_at && (
              <div><span className="text-slate-500">مدة الحل:</span> {duration(Math.round((new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / 60000))}</div>
            )}
            {ticket.description && <p className="whitespace-pre-line sm:col-span-2">{ticket.description}</p>}
            <div className="sm:col-span-2"><Files list={filesFor(null)} /></div>
          </div>

          <h2 className="font-bold">سجل المتابعة</h2>
          <ol className="relative space-y-3 border-s-2 border-slate-200 ps-4">
            {((events ?? []) as unknown as Ev[]).map((e) => (
              <li key={e.id} className="card p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span><b>{e.profiles?.full_name ?? "النظام"}</b> {eventText(e)}</span>
                  <span className="text-xs text-slate-400" title={formatDateTime(e.created_at)}>{timeAgo(e.created_at)}</span>
                </div>
                {e.body && <p className="mt-1 whitespace-pre-line text-slate-700">{e.body}</p>}
                <Files list={filesFor(e.id)} />
              </li>
            ))}
          </ol>
          <CommentBox ticketId={ticket.id} />
        </div>

        <div className="space-y-4">
          {role === "technician" && ticket.assigned_to === user.id && isOpen && (
            <section className="card grid gap-3 p-4">
              <h2 className="font-bold">تحديث الحالة</h2>
              <StatusButtons id={ticket.id} options={[
                { status: "in_progress", label: "بدأت الشغل" },
                { status: "waiting_parts", label: "مستني قطع غيار" },
                { status: "resolved", label: "✓ اتحلت", cls: "btn-primary" },
              ].filter((o) => o.status !== ticket.status)} />
            </section>
          )}

          {role === "supervisor" && ticket.status === "resolved" && (
            <section className="card grid gap-3 border-brand-500 p-4">
              <h2 className="font-bold">الفني قال إن المشكلة اتحلت</h2>
              <p className="text-sm text-slate-500">اتأكد في الفرع وبعدين:</p>
              <StatusButtons id={ticket.id} options={[
                { status: "closed", label: "✓ تأكيد وقفل البلاغ", cls: "btn-primary" },
                { status: "in_progress", label: "لسه المشكلة موجودة", cls: "btn-danger" },
              ]} />
            </section>
          )}
          {role === "supervisor" && ticket.status === "closed" && (
            <StatusButtons id={ticket.id} options={[{ status: "in_progress", label: "إعادة فتح البلاغ", cls: "btn-danger" }]} />
          )}

          {isManager && (
            <>
              <section>
                <h2 className="mb-2 font-bold">تحويل لفني</h2>
                <ActionForm action={assignAction.bind(null, ticket.id)} className="card grid gap-3 p-4">
                  <Field label="الفني">
                    <select name="assigned_to" defaultValue={ticket.assigned_to ?? (ticket.assignee_display ? "external" : "")} className="input">
                      <option value="">— بدون —</option>
                      {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                      <option value="external">فني خارجي (مش عنده حساب)</option>
                    </select>
                  </Field>
                  <Field label="اسم الفني الخارجي"><input name="assignee_name" defaultValue={ticket.assigned_to ? "" : ticket.assignee_display ?? ""} className="input" /></Field>
                  <Field label="رقم واتساب الفني"><input name="assignee_phone" defaultValue={ticket.assigned_to ? "" : ticket.assignee_contact ?? ""} className="input text-right" dir="ltr" placeholder="05xxxxxxxx" /></Field>
                  <SubmitButton>حفظ التحويل</SubmitButton>
                </ActionForm>
              </section>

              <section>
                <h2 className="mb-2 font-bold">الحالة والأولوية</h2>
                <div className="card grid gap-4 p-4">
                  <ActionForm action={setStatusAction.bind(null, ticket.id)} className="grid gap-2">
                    <Field label="الحالة">
                      <select name="status" defaultValue={ticket.status} className="input">
                        {Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </Field>
                    <input name="note" className="input" placeholder="ملاحظة (اختياري)" />
                    <SubmitButton className="btn-ghost">تحديث الحالة</SubmitButton>
                  </ActionForm>
                  <ActionForm action={priorityAction.bind(null, ticket.id)} className="grid gap-2">
                    <Field label="الأولوية">
                      <select name="priority" defaultValue={ticket.priority} className="input">
                        {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.hint}</option>)}
                      </select>
                    </Field>
                    <SubmitButton className="btn-ghost">تغيير الأولوية</SubmitButton>
                  </ActionForm>
                </div>
              </section>
            </>
          )}
          {ticket.last_reminder_at && <p className="text-xs text-slate-500">آخر تذكير: {timeAgo(ticket.last_reminder_at)}</p>}
        </div>
      </div>
    </>
  );
}
