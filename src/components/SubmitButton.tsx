"use client";
import { useContext } from "react";
import { useFormStatus } from "react-dom";
import { PendingContext } from "./ActionForm";

export function SubmitButton({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const ctx = useContext(PendingContext);
  const { pending: formPending } = useFormStatus();
  const pending = ctx ?? formPending;
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "جاري الحفظ..." : children}
    </button>
  );
}
