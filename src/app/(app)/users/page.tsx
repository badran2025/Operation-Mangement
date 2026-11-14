import { ChevronDownIcon } from "lucide-react";
import { requireAdmin, type Role } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/config";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader, Panel } from "@/components/app/blocks";
import { createUser, updateUser } from "./actions";

export const dynamic = "force-dynamic";
const ROLES: Role[] = ["admin", "supervisor", "maintenance_manager", "technician"];

export default async function UsersPage() {
  const { supabase, user } = await requireAdmin();
  const { t, locale } = await getT();
  const U = t.users;
  const [{ data: profiles }, { data: links }, { data: branches }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("profile_branches").select("*"),
    supabase.from("branches").select("id, name_ar, name_en, city_id").order("city_id").order("sort"),
  ]);
  const canCreate = Boolean(process.env.SUPABASE_SECRET_KEY);
  const chip = "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-input bg-surface px-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-surface-tint has-[:checked]:text-accent-foreground";

  return (
    <>
      <PageHeader title={U.title} sub={U.sub} />
      <Panel title={U.add}>
        {canCreate ? (
          <ActionForm action={createUser} className="grid gap-3 sm:grid-cols-[1fr_1.3fr_1fr_auto] sm:items-end">
            <Field><FieldLabel htmlFor="u-name">{U.name}</FieldLabel><Input id="u-name" name="full_name" required dir="auto" /></Field>
            <Field><FieldLabel htmlFor="u-email">{U.email}</FieldLabel><Input id="u-email" name="email" type="email" required dir="ltr" autoComplete="off" spellCheck={false} /></Field>
            <Field><FieldLabel htmlFor="u-pw">{U.tempPassword}</FieldLabel><Input id="u-pw" name="password" required minLength={8} dir="ltr" autoComplete="new-password" /></Field>
            <SubmitButton>{U.create}</SubmitButton>
          </ActionForm>
        ) : <p className="text-sm text-ink-muted">{U.needsKey}</p>}
      </Panel>

      <div className="flex flex-col gap-3">
        {(profiles ?? []).map((p) => {
          const mine = new Set((links ?? []).filter((l) => l.profile_id === p.id).map((l) => l.branch_id));
          const self = p.id === user.id;
          return (
            <details key={p.id} className="group rounded-2xl bg-surface" open={!p.active}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4 md:px-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="font-semibold" dir="auto">{p.full_name || "—"}</span>
                  <span className="ms-2 text-sm text-ink-muted" dir="ltr">{p.email}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant={p.active ? "success" : "warning"}>{p.active ? U.active : U.pending}</Badge>
                  <Badge variant="neutral">{t.roles[p.role as Role]}</Badge>
                  {p.role === "supervisor" && <Badge variant="info">{U.branchesN(mine.size)}</Badge>}
                  <ChevronDownIcon className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
                </span>
              </summary>
              <ActionForm action={updateUser.bind(null, p.id)} className="group/form flex flex-col gap-4 px-4 pb-5 md:px-5">
                <div className="flex flex-wrap items-end gap-4">
                  <Field className="w-auto min-w-56">
                    <FieldLabel htmlFor={`role-${p.id}`}>{U.role}</FieldLabel>
                    <NativeSelect id={`role-${p.id}`} name="role" defaultValue={p.role} disabled={self} className="w-full">
                      {ROLES.map((r) => <NativeSelectOption key={r} value={r}>{t.roles[r]}</NativeSelectOption>)}
                    </NativeSelect>
                    {self && <input type="hidden" name="role" value={p.role} />}
                  </Field>
                  <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" name="active" defaultChecked={p.active} disabled={self} className="size-4 accent-primary" /> {U.accountActive}
                    {self && <input type="hidden" name="active" value="on" />}
                  </label>
                </div>
                <FieldSet className="hidden group-has-[option[value=supervisor]:checked]/form:flex">
                  <FieldLegend variant="label">{U.branchesFor}</FieldLegend>
                  <div className="flex flex-wrap gap-2">
                    {(branches ?? []).map((b) => (
                      <label key={b.id} className={chip}>
                        <input type="checkbox" name="branch_ids" value={b.id} defaultChecked={mine.has(b.id)} className="accent-primary" /> {pick(locale, b.name_ar, b.name_en)}
                      </label>
                    ))}
                  </div>
                </FieldSet>
                <div><SubmitButton>{t.common.save}</SubmitButton></div>
              </ActionForm>
            </details>
          );
        })}
      </div>
    </>
  );
}
