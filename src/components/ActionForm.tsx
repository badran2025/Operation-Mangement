"use client";
import { createContext, startTransition, useActionState } from "react";

export type ActionState = { error?: string; ok?: string };

export const PendingContext = createContext<boolean | null>(null);

/**
 * Form wrapper that shows the server action's error / success message.
 * Submits manually (not via the `action` prop) so React does NOT reset the fields —
 * the user keeps what they typed when there's a validation error.
 */
export function ActionForm({
  action, children, className,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state.error && <p className="mt-3 text-sm font-semibold text-red-600 sm:col-span-full">{state.error}</p>}
      {state.ok && !pending && <p className="mt-3 text-sm font-semibold text-brand-700 sm:col-span-full">{state.ok}</p>}
    </form>
  );
}
