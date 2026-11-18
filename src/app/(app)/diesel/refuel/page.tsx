import { getT } from "@/lib/i18n/server";
import { PageHeader, Panel } from "@/components/app/blocks";
import { RefuelForm } from "../Forms";
import { loadDieselForm } from "../load";

export const dynamic = "force-dynamic";

export default async function RefuelPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const { t } = await getT();
  const data = await loadDieselForm();
  const { branch } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader back={{ href: "/diesel", label: t.diesel.title }} title={t.diesel.recordRefuel} />
      <Panel className="mt-6"><RefuelForm {...data} defaultBranch={branch ? Number(branch) : undefined} /></Panel>
    </div>
  );
}
