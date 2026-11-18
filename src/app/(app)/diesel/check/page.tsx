import { getT } from "@/lib/i18n/server";
import { PageHeader, Panel } from "@/components/app/blocks";
import { CheckForm } from "../Forms";
import { loadDieselForm } from "../load";

export const dynamic = "force-dynamic";

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const { t } = await getT();
  const data = await loadDieselForm();
  const { branch } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader back={{ href: "/diesel", label: t.diesel.title }} title={t.diesel.recordCheck} />
      <Panel className="mt-6"><CheckForm {...data} defaultBranch={branch ? Number(branch) : undefined} /></Panel>
    </div>
  );
}
