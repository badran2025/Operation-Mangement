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
import { addCommentAction, refreshTicket, reminderAction } from "../actions";

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
