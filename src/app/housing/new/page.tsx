import { createHousing } from "@/lib/actions";
import { HousingForm } from "@/components/HousingForm";
import { PageHeader } from "@/components/PageHeader";

export default function NewHousingPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="إضافة سكن" back={{ href: "/housing", label: "السكن" }} />
      <HousingForm action={createHousing} />
    </div>
  );
}
