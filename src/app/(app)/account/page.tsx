import { requireActive } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/app/blocks";
import { changePassword } from "../users/actions";

export default async function AccountPage() {
  const { profile } = await requireActive();
  const { t } = await getT();
  return (
    <div className="mx-auto w-full max-w-md">
      <PageHeader title={t.account.title} sub={<span><span dir="ltr">{profile.email}</span>{t.common.comma}{t.roles[profile.role]}</span>} />
      <Panel className="mt-6">
        <ActionForm action={changePassword}>
          <FieldGroup>
            <Field><FieldLabel htmlFor="pw">{t.account.newPassword}</FieldLabel><Input id="pw" name="password" type="password" minLength={8} required dir="ltr" autoComplete="new-password" /></Field>
            <Field><FieldLabel htmlFor="pw2">{t.account.confirm}</FieldLabel><Input id="pw2" name="confirm" type="password" minLength={8} required dir="ltr" autoComplete="new-password" /></Field>
            <SubmitButton>{t.account.change}</SubmitButton>
          </FieldGroup>
        </ActionForm>
      </Panel>
    </div>
  );
}
