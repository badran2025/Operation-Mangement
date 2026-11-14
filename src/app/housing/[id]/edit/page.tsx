import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteHousing, updateHousing } from "@/lib/actions";
import { HousingForm } from "@/components/HousingForm";
import { PageHeader } from "@/components/PageHeader";
import { DeleteButton } from "@/components/DeleteButton";

export default async function EditHousingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const housing = await db.housing.findUnique({ where: { id }, include: { _count: { select: { workers: true } } } });
  if (!housing) notFound();
  return (
    <div className="max-w-2xl">
      <PageHeader title={`تعديل: ${housing.name}`} back={{ href: "/housing", label: "السكن" }}>
        <DeleteButton
          action={deleteHousing.bind(null, id)}
          confirmText={`متأكد؟ العمال الساكنين هنا (${housing._count.workers}) هيفضلوا موجودين بس من غير سكن.`}
          label="حذف السكن"
        />
      </PageHeader>
      <HousingForm action={updateHousing.bind(null, id)} housing={housing} />
    </div>
  );
}
