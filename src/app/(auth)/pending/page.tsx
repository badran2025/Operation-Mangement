import { signOut } from "../actions";

export default function PendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-sm p-8 text-center">
        <div className="text-lg font-bold">حسابك لسه مش متفعّل</div>
        <p className="mt-2 text-sm text-slate-500">مدير التشغيل لازم يفعّل حسابك ويحدد صلاحياتك الأول.</p>
        <form action={signOut} className="mt-6">
          <button className="btn-ghost">تسجيل الخروج</button>
        </form>
      </div>
    </main>
  );
}
