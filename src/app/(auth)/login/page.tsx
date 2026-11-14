import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn } from "../actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-brand-700">كلين</div>
          <div className="mt-1 text-sm text-slate-500">نظام إدارة التشغيل</div>
        </div>
        <ActionForm action={signIn} className="card grid gap-4 p-6">
          <div>
            <label className="label">الإيميل</label>
            <input name="email" type="email" required dir="ltr" autoComplete="email" className="input text-left" />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input name="password" type="password" required dir="ltr" autoComplete="current-password" className="input text-left" />
          </div>
          <SubmitButton>تسجيل الدخول</SubmitButton>
        </ActionForm>
        <p className="mt-4 text-center text-xs text-slate-500">مفيش حساب؟ اطلب من مدير التشغيل يعملك حساب.</p>
      </div>
    </main>
  );
}
