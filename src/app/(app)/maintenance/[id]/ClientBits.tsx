"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadTicketFiles } from "@/lib/upload";
import { FilePicker } from "@/components/FilePicker";
import { addCommentAction, refreshTicket, reminderAction } from "../actions";

export function CommentBox({ ticketId }: { ticketId: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"comment" | "parts">("comment");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() && files.length === 0) return;
    setBusy(true); setError(null);
    const res = await addCommentAction(ticketId, text || (files.length ? "مرفقات" : ""), kind);
    if (res.error) { setBusy(false); setError(res.error); return; }
    const upErr = await uploadTicketFiles(ticketId, files, res.eventId);
    await refreshTicket(ticketId);
    setBusy(false);
    if (upErr) { setError(upErr); return; }
    setText(""); setFiles([]); setKind("comment");
    router.refresh();
  }

  return (
    <div className="card grid gap-3 p-4">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="input"
        placeholder="اكتب تحديث أو ملاحظة… (مثال: الفني وصل، اتغيرت القطعة)" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <FilePicker files={files} onChange={setFiles} />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={kind === "parts"} onChange={(e) => setKind(e.target.checked ? "parts" : "comment")} />
            ده تحديث عن قطع غيار
          </label>
        </div>
        <button onClick={send} className="btn-primary" disabled={busy}>{busy ? "جاري الإرسال..." : "إضافة للسجل"}</button>
      </div>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export function ReminderButton({ ticketId, phone, message }: { ticketId: number; phone: string; message: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost"
      disabled={busy}
      onClick={async () => {
        // open WhatsApp first (popup blockers allow it only inside the click)
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
        setBusy(true);
        await reminderAction(ticketId);
        setBusy(false);
      }}
    >
      💬 تذكير واتساب
    </button>
  );
}
