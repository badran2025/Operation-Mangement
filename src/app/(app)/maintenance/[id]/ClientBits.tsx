"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { uploadTicketFiles } from "@/lib/upload";
import { FilePicker } from "@/components/FilePicker";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PRIORITIES } from "@/lib/tickets";
import { addCommentAction, assignAction, refreshTicket, reminderAction, setStatusAction } from "../actions";

type Variant = "default" | "outline" | "destructive" | "ghost";

/** One workflow step. Steps that need a reason open a short form first. */
export function StepButton({ ticketId, status, label, variant = "outline", reasonPh }: { ticketId: number; status: string; label: string; variant?: Variant; reasonPh?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (reasonPh && !open) return <Button variant={variant} onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <ActionForm action={setStatusAction.bind(null, ticketId)} className={reasonPh ? "flex w-full flex-col gap-2 rounded-[14px] bg-canvas p-3" : undefined}>
      <input type="hidden" name="status" value={status} />
      {reasonPh && (
        <>
          <Input name="note" required autoFocus placeholder={reasonPh} aria-label={reasonPh} dir="auto" />
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant={variant}>{label}</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
          </div>
        </>
      )}
      {!reasonPh && <SubmitButton variant={variant}>{label}</SubmitButton>}
    </ActionForm>
  );
}

/** Triage: who fixes it and how urgent it is. External-technician fields only appear when needed. */
export function AssignForm({ ticketId, staff, current, priority, submitLabel }: {
  ticketId: number; staff: { id: string; name: string }[];
  current: { userId: string | null; name: string | null; phone: string | null }; priority: string; submitLabel: string;
}) {
  const { t } = useI18n();
  const M = t.maintenance;
  const hadTech = Boolean(current.userId || current.name);
  const [who, setWho] = useState(current.userId ?? (current.name ? "external" : ""));
  return (
    <ActionForm action={assignAction.bind(null, ticketId)} className="flex flex-col gap-4">
      <input type="hidden" name="current_priority" value={priority} />
      <input type="hidden" name="had_tech" value={hadTech ? "1" : ""} />
      <Field>
        <FieldLabel htmlFor="as-who">{M.technician}</FieldLabel>
        <NativeSelect id="as-who" name="assigned_to" value={who} onChange={(e) => setWho(e.target.value)} className="w-full">
          <NativeSelectOption value="">{hadTech ? M.nobody : M.flow.chooseTech}</NativeSelectOption>
          {staff.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
          <NativeSelectOption value="external">{M.externalTech}</NativeSelectOption>
        </NativeSelect>
      </Field>
      {who === "external" && (
        <>
          <Field><FieldLabel htmlFor="as-name">{M.externalName}</FieldLabel><Input id="as-name" name="assignee_name" required defaultValue={current.userId ? "" : current.name ?? ""} dir="auto" /></Field>
          <Field><FieldLabel htmlFor="as-phone">{M.techWhatsapp}</FieldLabel><Input id="as-phone" name="assignee_phone" type="tel" inputMode="tel" defaultValue={current.userId ? "" : current.phone ?? ""} dir="ltr" placeholder="05xxxxxxxx" /></Field>
        </>
      )}
      <Field>
        <FieldLabel htmlFor="as-pr">{M.priorityLabel}</FieldLabel>
        <NativeSelect id="as-pr" name="priority" defaultValue={priority} className="w-full">
          {PRIORITIES.map((k) => <NativeSelectOption key={k} value={k}>{M.priority[k]}: {M.priorityHint[k]}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

export function CommentBox({ ticketId }: { ticketId: number }) {
  const { t } = useI18n();
  const M = t.maintenance;
  const router = useRouter();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"comment" | "parts">("comment");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() && files.length === 0) return;
    setBusy(true); setError(null);
    const res = await addCommentAction(ticketId, text || M.addFiles, kind);
    if (res.error) { setBusy(false); setError(res.error); return; }
    const upErr = await uploadTicketFiles(ticketId, files, t.errors, res.eventId);
    await refreshTicket(ticketId);
    setBusy(false);
    if (upErr) { setError(upErr); return; }
    setText(""); setFiles([]); setKind("comment");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={M.commentPh} aria-label={M.commentPh} dir="auto" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilePicker files={files} onChange={setFiles} />
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={kind === "parts"} onChange={(e) => setKind(e.target.checked ? "parts" : "comment")} className="size-4 accent-primary" />
            {M.partsUpdate}
          </label>
        </div>
        <Button onClick={send} disabled={busy}>{busy && <Spinner data-icon="inline-start" />}{busy ? M.sending : M.addToLog}</Button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

export function ReminderButton({ ticketId, phone, message }: { ticketId: number; phone: string; message: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        // open WhatsApp inside the click (popup blockers), then log the reminder
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
        setBusy(true);
        await reminderAction(ticketId);
        setBusy(false);
      }}
    >
      <MessageCircleIcon data-icon="inline-start" />{t.maintenance.reminder}
    </Button>
  );
}
