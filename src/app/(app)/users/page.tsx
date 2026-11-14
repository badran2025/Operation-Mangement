import { requireAdmin, ROLE_LABELS, type Role } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Field, PageHeader } from "@/components/ui";
import { createUser, updateUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { supabase, user } = await requireAdmin();
  const [{ data: profiles }, { data: links }, { data: branches }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("profile_branches").select("*"),
    supabase.from("branches").select("id, name_ar, city_id").order("city_id").order("sort"),
  ]);
  const canCreate = Boolean(process.env.SUPABASE_SECRET_KEY);

  return (
    <>
      <PageHeader title="المستخدمين والصلاحيات" subtitle="مين يدخل الموقع، ودوره، وأنهي فروع يشوفها" />

      <section className="mb-8">
        <h2 className="mb-2 font-bold">إضافة مستخدم</h2>
        {canCreate ? (
          <ActionForm action={createUser} className="card grid gap-3 p-5 sm:grid-cols-4">
            <Field label="الاسم"><input name="full_name" required className="input" /></Field>
            <Field label="الإيميل"><input name="email" type="email" required className="input text-left" dir="ltr" /></Field>
            <Field label="كلمة مرور مؤقتة"><input name="password" required minLength={8} className="input text-left" dir="ltr" /></Field>
            <div className="flex items-end"><SubmitButton>إضافة</SubmitButton></div>
          </ActionForm>
        ) : (
          <div className="card p-4 text-sm text-slate-600">
            إضافة المستخدمين من هنا محتاجة خطوة إعداد واحدة: مفتاح <code dir="ltr">SUPABASE_SECRET_KEY</code> في إعدادات Netlify.
          </div>
        )}
      </section>

      <div className="space-y-3">
        {(profiles ?? []).map((p) => {
          const mine = new Set((links ?? []).filter((l) => l.profile_id === p.id).map((l) => l.branch_id));
          return (
            <details key={p.id} className="card p-4" open={!p.active}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{p.full_name || "—"} <span className="text-sm font-normal text-slate-500" dir="ltr">{p.email}</span></span>
                <span className="flex gap-2">
                  <Badge tone={p.active ? "green" : "amber"}>{p.active ? "مفعّل" : "مستني التفعيل"}</Badge>
                  <Badge>{ROLE_LABELS[p.role as Role]}</Badge>
                  {p.role === "supervisor" && <Badge tone="blue">{mine.size} فرع</Badge>}
                </span>
              </summary>
              <ActionForm action={updateUser.bind(null, p.id)} className="mt-4 grid gap-4">
                <div className="flex flex-wrap items-end gap-4">
                  <Field label="الدور">
                    <select name="role" defaultValue={p.role} className="input" disabled={p.id === user.id}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {p.id === user.id && <input type="hidden" name="role" value={p.role} />}
                  </Field>
                  <label className="flex items-center gap-2 pb-2 text-sm font-semibold">
                    <input type="checkbox" name="active" defaultChecked={p.active} disabled={p.id === user.id} /> الحساب مفعّل
                    {p.id === user.id && <input type="hidden" name="active" value="on" />}
                  </label>
                </div>
                <fieldset>
                  <legend className="label">الفروع (للمشرف)</legend>
                  <div className="flex flex-wrap gap-2">
                    {(branches ?? []).map((b) => (
                      <label key={b.id} className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                        <input type="checkbox" name="branch_ids" value={b.id} defaultChecked={mine.has(b.id)} /> {b.name_ar}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div><SubmitButton>حفظ</SubmitButton></div>
              </ActionForm>
            </details>
          );
        })}
      </div>
    </>
  );
}
