"use client";
import { createClient } from "./supabase/browser";

/** Shrink photos before upload (max 1600px, JPEG) — keeps storage small on the free plan. */
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.size < 300_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.75));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export const MAX_FILE_MB = 20;

/** Upload files for a ticket and register them. Returns an error message or null. */
export async function uploadTicketFiles(ticketId: number, files: File[], eventId?: number | null): Promise<string | null> {
  if (files.length === 0) return null;
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  for (const file of files) {
    const blob = await compress(file);
    if (blob.size > MAX_FILE_MB * 1024 * 1024) return `الملف ${file.name} أكبر من ${MAX_FILE_MB} ميجا`;
    const isJpeg = blob !== file;
    const ext = isJpeg ? "jpg" : (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
    const type = isJpeg ? "image/jpeg" : file.type;
    const up = await supabase.storage.from("ticket-files").upload(path, blob, { contentType: type });
    if (up.error) return `فشل رفع ${file.name}: ${up.error.message}`;
    const ins = await supabase.from("ticket_attachments").insert({
      ticket_id: ticketId, event_id: eventId ?? null, file_path: path, mime_type: type, uploaded_by: auth.user?.id,
    });
    if (ins.error) return `فشل تسجيل ${file.name}: ${ins.error.message}`;
  }
  return null;
}
