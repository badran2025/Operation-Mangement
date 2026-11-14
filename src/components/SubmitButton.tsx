"use client";
import { useContext } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { PendingContext } from "./ActionForm";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive";

export function SubmitButton({ children, className = "", variant }: { children: React.ReactNode; className?: string; variant?: Variant }) {
  const ctx = useContext(PendingContext);
  const { pending: formPending } = useFormStatus();
  const pending = ctx ?? formPending;
  const { t } = useI18n();
  return (
    <Button type="submit" variant={variant ?? "default"} disabled={pending} className={cn(className)}>
      {pending && <Spinner data-icon="inline-start" />}
      {pending ? t.common.saving : children}
    </Button>
  );
}
