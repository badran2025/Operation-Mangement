import { WEEKDAYS, type Shift } from "@/lib/format";
import { Field } from "./ui";

type Opt = { id: number; name: string };
type Info = Partial<{
  full_name: string; alt_name: string | null; emp_no: string | null; nationality: string | null; gender: string | null;
  phone: string | null; email: string | null; birth_date: string | null; blood_type: string | null;
  emergency_contact: string | null; joined_at: string | null; status: string; housing_id: number | null;
  shoe_size: string | null; uniform_size: string | null; notes: string | null;
}>;

export function InfoFields({ w = {}, housings }: { w?: Info; housings: Opt[] }) {
  return (
    <>
      <Field label="الاسم الكامل *"><input name="full_name" required defaultValue={w.full_name} className="input" /></Field>
      <Field label="اسم مختصر / اسم الجدول"><input name="alt_name" defaultValue={w.alt_name ?? ""} className="input" /></Field>
      <Field label="الرقم الوظيفي"><input name="emp_no" defaultValue={w.emp_no ?? ""} className="input" dir="ltr" /></Field>
      <Field label="الجنسية"><input name="nationality" defaultValue={w.nationality ?? ""} className="input" /></Field>
      <Field label="النوع">
        <select name="gender" defaultValue={w.gender ?? ""} className="input">
          <option value="">—</option><option value="male">ذكر</option><option value="female">أنثى</option>
        </select>
      </Field>
      <Field label="الحالة">
        <select name="status" defaultValue={w.status ?? "active"} className="input">
          <option value="active">على رأس العمل</option><option value="on_leave">في إجازة</option><option value="terminated">منتهي</option>
        </select>
      </Field>
      <Field label="الجوال"><input name="phone" defaultValue={w.phone ?? ""} className="input text-right" dir="ltr" /></Field>
      <Field label="الإيميل"><input name="email" type="email" defaultValue={w.email ?? ""} className="input text-right" dir="ltr" /></Field>
      <Field label="تاريخ الميلاد"><input name="birth_date" type="date" defaultValue={w.birth_date ?? ""} className="input" /></Field>
      <Field label="تاريخ التعيين"><input name="joined_at" type="date" defaultValue={w.joined_at ?? ""} className="input" /></Field>
      <Field label="فصيلة الدم"><input name="blood_type" defaultValue={w.blood_type ?? ""} className="input" dir="ltr" placeholder="O+" /></Field>
      <Field label="رقم طوارئ"><input name="emergency_contact" defaultValue={w.emergency_contact ?? ""} className="input" /></Field>
      <Field label="السكن">
        <select name="housing_id" defaultValue={w.housing_id ?? ""} className="input">
          <option value="">غير محدد</option>
          {housings.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="مقاس الحذاء"><input name="shoe_size" defaultValue={w.shoe_size ?? ""} className="input" /></Field>
        <Field label="مقاس اليونيفورم"><input name="uniform_size" defaultValue={w.uniform_size ?? ""} className="input" /></Field>
      </div>
      <Field label="ملاحظات" className="sm:col-span-2"><textarea name="notes" rows={2} defaultValue={w.notes ?? ""} className="input" /></Field>
    </>
  );
}

const hhmm = (t?: string) => (t ? t.slice(0, 5) : "");

export function ScheduleFields({
  shifts = [], daysOff = [], noDayOff = false, breakTime = null,
}: { shifts?: Shift[]; daysOff?: number[]; noDayOff?: boolean; breakTime?: string | null }) {
  const rows = [0, 1];
  return (
    <>
      {rows.map((i) => (
        <div key={i} className="grid grid-cols-2 gap-3">
          <Field label={i === 0 ? "بداية الدوام" : "بداية الفترة التانية (لو الدوام متقسم)"}>
            <input name="shift_start" type="time" defaultValue={hhmm(shifts[i]?.start)} className="input" />
          </Field>
          <Field label={i === 0 ? "نهاية الدوام" : "نهاية الفترة التانية"}>
            <input name="shift_end" type="time" defaultValue={hhmm(shifts[i]?.end === "24:00:00" ? "00:00" : shifts[i]?.end)} className="input" />
          </Field>
        </div>
      ))}
      <p className="text-xs text-slate-500 sm:col-span-2">نهاية الدوام 12 بالليل = اكتب 00:00</p>
      <fieldset className="sm:col-span-2">
        <legend className="label">الإجازة الأسبوعية</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <label key={d.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
              <input type="checkbox" name="days_off" value={d.value} defaultChecked={daysOff.includes(d.value)} className="accent-brand-600" />
              {d.label}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
            <input type="checkbox" name="no_day_off" defaultChecked={noDayOff} /> بدون إجازة أسبوعية
          </label>
        </div>
      </fieldset>
      <Field label="وقت البريك"><input name="break_time" type="time" defaultValue={hhmm(breakTime ?? undefined)} className="input" /></Field>
    </>
  );
}
