import { getT } from "@/lib/i18n/server";
import { PageHeader, Panel } from "@/components/app/blocks";
import { loadDieselForm } from "../load";
import { ReadingForm } from "./ReadingForm";

export const dynamic = "force-dynamic";

/** A level reading without a delivery (optional; best on the 1st of the month). */
export default async function CheckPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const { t } = await getT();
  const data = await loadDieselForm();
  const { branch } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader back={{ href: "/diesel", label: t.diesel.title }} title={t.diesel.perf.readingTitle} sub={t.diesel.perf.readingSub} />
      <Panel className="mt-6"><ReadingForm {...data} defaultBranch={branch ? Number(branch) : undefined} /></Panel>
    </div>
  );
}
