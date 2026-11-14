"use client";

export function DeleteButton({
  action,
  confirmText,
  label = "حذف",
}: {
  action: () => Promise<void>;
  confirmText: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" className="btn-danger">{label}</button>
    </form>
  );
}
