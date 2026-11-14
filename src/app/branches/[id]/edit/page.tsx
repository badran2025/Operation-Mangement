import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateBranch } from "@/lib/actions";
import { BranchForm } from "@/components/BranchForm";
import { PageHeader } from "@/components/PageHeader";

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const branch = await db.branch.findUnique({ where: { id } });
  if (!branch) notFound();
  return (
    <div className="max-w-2xl">
      <PageHeader title={`تعديل: ${branch.name}`} back={{ href: `/branches/${id}`, label: branch.name }} />
      <BranchForm action={updateBranch.bind(null, id)} branch={branch} />
    </div>
  );
}
