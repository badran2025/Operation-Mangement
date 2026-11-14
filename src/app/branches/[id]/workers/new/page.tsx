import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createWorker } from "@/lib/actions";
import { WorkerForm } from "@/components/WorkerForm";
import { PageHeader } from "@/components/PageHeader";

export default async function NewWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [branch, branches, housings] = await Promise.all([
    db.branch.findUnique({ where: { id } }),
    db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.housing.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!branch) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`إضافة عامل — ${branch.name}`} back={{ href: `/branches/${id}`, label: branch.name }} />
      <WorkerForm action={createWorker} branches={branches} housings={housings} defaultBranchId={id} />
    </div>
  );
}
