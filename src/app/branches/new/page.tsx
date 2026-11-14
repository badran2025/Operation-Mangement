import { createBranch } from "@/lib/actions";
import { BranchForm } from "@/components/BranchForm";
import { PageHeader } from "@/components/PageHeader";

export default function NewBranchPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="إضافة فرع جديد" back={{ href: "/", label: "الفروع" }} />
      <BranchForm action={createBranch} />
    </div>
  );
}
