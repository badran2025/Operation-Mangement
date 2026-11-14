import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { signOut } from "../actions";

export default async function PendingPage() {
  const { t } = await getT();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm rounded-2xl bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold">{t.auth.pendingTitle}</h1>
        <p className="mt-2 text-ink-muted">{t.auth.pendingBody}</p>
        <form action={signOut} className="mt-6"><Button variant="outline" type="submit">{t.nav.signOut}</Button></form>
      </div>
    </main>
  );
}
