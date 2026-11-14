// بيانات تجريبية: npm run seed
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  await db.worker.deleteMany();
  await db.branch.deleteMany();
  await db.housing.deleteMany();

  const h1 = await db.housing.create({ data: { name: "سكن العزيزية", address: "شارع 15 - عمارة 3" } });
  const h2 = await db.housing.create({ data: { name: "سكن النسيم", address: "بجوار المسجد الكبير" } });

  const b1 = await db.branch.create({ data: { name: "فرع الرئيسي", address: "طريق الملك فهد", supervisor: "محمد علي", phone: "0500000001" } });
  const b2 = await db.branch.create({ data: { name: "فرع الشمال", address: "حي النخيل", supervisor: "أحمد حسن", phone: "0500000002" } });
  await db.branch.create({ data: { name: "فرع الجنوب", address: "حي الشفا" } });

  const workers = [
    { name: "كريم سعيد", jobTitle: "عامل نظافة", shiftStart: "06:00", shiftEnd: "14:00", daysOff: "5", branchId: b1.id, housingId: h1.id },
    { name: "رامي فتحي", jobTitle: "عامل نظافة", shiftStart: "14:00", shiftEnd: "22:00", daysOff: "6", branchId: b1.id, housingId: h1.id },
    { name: "سامح عادل", jobTitle: "مشرف وردية", shiftStart: "08:00", shiftEnd: "16:00", daysOff: "5", branchId: b1.id, housingId: h2.id },
    { name: "عمرو ناصر", jobTitle: "عامل نظافة", shiftStart: "22:00", shiftEnd: "06:00", daysOff: "0", branchId: b2.id, housingId: h2.id },
    { name: "يوسف خالد", jobTitle: "عامل نظافة", shiftStart: "06:00", shiftEnd: "14:00", daysOff: "1", branchId: b2.id, housingId: null },
  ];
  for (const w of workers) await db.worker.create({ data: w });
}

main().finally(() => db.$disconnect());
