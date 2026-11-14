import { getT } from "@/lib/i18n/server";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LangToggle, ThemeToggle } from "@/components/app/toggles";
import { signIn } from "../actions";

export default async function LoginPage() {
  const { t } = await getT();
  return (
    <main className="flex min-h-dvh flex-col px-4">
      <div className="flex justify-end gap-2 py-4"><LangToggle /><ThemeToggle /></div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-16">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand text-xl font-bold text-white shadow-[inset_0_-4px_0_var(--brand-accent)]" aria-hidden>k</span>
          <h1 className="text-2xl font-semibold">{t.auth.title}</h1>
          <p className="text-ink-muted">{t.auth.subtitle}</p>
        </div>
        <ActionForm action={signIn} className="rounded-2xl bg-surface p-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{t.auth.email}</FieldLabel>
              <Input id="email" name="email" type="email" required dir="ltr" autoComplete="email" className="h-10" />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">{t.auth.password}</FieldLabel>
              <Input id="password" name="password" type="password" required dir="ltr" autoComplete="current-password" className="h-10" />
            </Field>
            <SubmitButton className="w-full">{t.auth.signIn}</SubmitButton>
          </FieldGroup>
        </ActionForm>
        <p className="mt-4 text-center text-[13px] text-ink-muted">{t.auth.noAccount}</p>
      </div>
    </main>
  );
}
