import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteWorker, updateWorker } from "@/lib/actions";
import { WorkerForm } from "@/components/WorkerForm";
import { PageHeader } from "@/components/PageHeader";
import { DeleteButton } from "@/components/DeleteButton";

export default async function EditWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [worker, branches, housings] = await Promise.all([
    db.worker.findUnique({ where: { id }, include: { branch: true } }),
    db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.housing.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!worker) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`تعديل: ${worker.name}`} back={{ href: `/branches/${worker.branchId}`, label: worker.branch.name }}>
        <DeleteButton action={deleteWorker.bind(null, id)} confirmText={`متأكد إنك عايز تحذف "${worker.name}"؟`} label="حذف العامل" />
      </PageHeader>
      <p className="mb-3 text-sm text-slate-500">لنقل العامل لفرع تاني غيّر الفرع من القائمة.</p>
      <WorkerForm action={updateWorker.bind(null, id)} worker={worker} branches={branches} housings={housings} />
    </div>
  );
}
