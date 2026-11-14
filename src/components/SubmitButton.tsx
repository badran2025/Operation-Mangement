"use client";
import { useContext } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { PendingContext } from "./ActionForm";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive";
const LEGACY: Record<string, Variant> = { "btn-primary": "default", "btn-ghost": "outline", "btn-danger": "destructive" };

export function SubmitButton({ children, className = "", variant }: { children: React.ReactNode; className?: string; variant?: Variant }) {
  const ctx = useContext(PendingContext);
  const { pending: formPending } = useFormStatus();
  const pending = ctx ?? formPending;
  const { t } = useI18n();
  // Accept legacy class names ("btn-ghost") from pages not yet rebuilt.
  const v = variant ?? LEGACY[className.trim()] ?? "default";
  const rest = LEGACY[className.trim()] ? "" : className;
  return (
    <Button type="submit" variant={v} disabled={pending} className={cn(rest)}>
      {pending && <Spinner data-icon="inline-start" />}
      {pending ? t.common.saving : children}
    </Button>
  );
}
