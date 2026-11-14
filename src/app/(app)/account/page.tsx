import { requireActive, ROLE_LABELS } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, PageHeader } from "@/components/ui";
import { changePassword } from "../users/actions";

export default async function AccountPage() {
  const { profile } = await requireActive();
  return (
    <div className="max-w-md">
      <PageHeader title="حسابي" subtitle={`${profile.email} · ${ROLE_LABELS[profile.role]}`} />
      <ActionForm action={changePassword} className="card grid gap-4 p-5">
        <Field label="كلمة مرور جديدة"><input name="password" type="password" minLength={8} required className="input text-left" dir="ltr" autoComplete="new-password" /></Field>
        <Field label="تأكيد كلمة المرور"><input name="confirm" type="password" minLength={8} required className="input text-left" dir="ltr" autoComplete="new-password" /></Field>
        <SubmitButton>تغيير كلمة المرور</SubmitButton>
      </ActionForm>
    </div>
  );
}
