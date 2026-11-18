"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { deleteRefuel } from "./actions";

export function DeleteRefuel({ id }: { id: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button type="button" disabled={busy} aria-label={t.common.delete}
      className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
      onClick={() => window.confirm(`${t.common.delete}?`) && start(async () => { const r = await deleteRefuel(id); if (r.error) window.alert(r.error); else router.refresh(); })}>
      <Trash2Icon className="size-4" aria-hidden />
    </button>
  );
}
