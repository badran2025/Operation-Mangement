import type { Dict } from "@/lib/i18n/dictionaries";
import type { Shift } from "@/lib/i18n/format";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Opt = { id: number; name: string };
type Info = Partial<{
  full_name: string; alt_name: string | null; emp_no: string | null; nationality: string | null; gender: string | null;
  phone: string | null; email: string | null; birth_date: string | null; blood_type: string | null;
  emergency_contact: string | null; joined_at: string | null; status: string; housing_id: number | null;
  shoe_size: string | null; uniform_size: string | null; notes: string | null;
}>;

function F({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
    </Field>
  );
}

export function InfoFields({ t, w = {}, housings }: { t: Dict; w?: Info; housings: Opt[] }) {
  const L = t.worker;
  return (
    <>
      <F id="full_name" label={`${L.fullName} *`}><Input id="full_name" name="full_name" required defaultValue={w.full_name} dir="auto" /></F>
      <F id="alt_name" label={L.altName}><Input id="alt_name" name="alt_name" defaultValue={w.alt_name ?? ""} dir="auto" /></F>
      <F id="emp_no" label={L.empNo}><Input id="emp_no" name="emp_no" defaultValue={w.emp_no ?? ""} dir="ltr" /></F>
      <F id="nationality" label={L.nationality}><Input id="nationality" name="nationality" defaultValue={w.nationality ?? ""} dir="auto" /></F>
      <F id="gender" label={L.gender}>
        <NativeSelect id="gender" name="gender" defaultValue={w.gender ?? ""} className="w-full">
          <NativeSelectOption value="">—</NativeSelectOption>
          <NativeSelectOption value="male">{L.male}</NativeSelectOption>
          <NativeSelectOption value="female">{L.female}</NativeSelectOption>
        </NativeSelect>
      </F>
      <F id="status" label={L.statusLabel}>
        <NativeSelect id="status" name="status" defaultValue={w.status ?? "active"} className="w-full">
          {(["active", "on_leave", "terminated"] as const).map((s) => <NativeSelectOption key={s} value={s}>{L.status[s]}</NativeSelectOption>)}
        </NativeSelect>
      </F>
      <F id="phone" label={t.common.phone}><Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={w.phone ?? ""} dir="ltr" /></F>
      <F id="email" label={t.common.email}><Input id="email" name="email" type="email" autoComplete="off" spellCheck={false} defaultValue={w.email ?? ""} dir="ltr" /></F>
      <F id="birth_date" label={L.birthDate}><Input id="birth_date" name="birth_date" type="date" defaultValue={w.birth_date ?? ""} /></F>
      <F id="joined_at" label={L.joinedAt}><Input id="joined_at" name="joined_at" type="date" defaultValue={w.joined_at ?? ""} /></F>
      <F id="blood_type" label={L.bloodType}><Input id="blood_type" name="blood_type" defaultValue={w.blood_type ?? ""} dir="ltr" placeholder="O+" /></F>
      <F id="emergency_contact" label={L.emergency}><Input id="emergency_contact" name="emergency_contact" defaultValue={w.emergency_contact ?? ""} dir="auto" /></F>
      <F id="housing_id" label={L.housing}>
        <NativeSelect id="housing_id" name="housing_id" defaultValue={w.housing_id ?? ""} className="w-full">
          <NativeSelectOption value="">{L.noHousing}</NativeSelectOption>
          {housings.map((h) => <NativeSelectOption key={h.id} value={h.id}>{h.name}</NativeSelectOption>)}
        </NativeSelect>
      </F>
      <div className="grid grid-cols-2 gap-3">
        <F id="shoe_size" label={L.shoe}><Input id="shoe_size" name="shoe_size" defaultValue={w.shoe_size ?? ""} dir="ltr" /></F>
        <F id="uniform_size" label={L.uniform}><Input id="uniform_size" name="uniform_size" defaultValue={w.uniform_size ?? ""} dir="ltr" /></F>
      </div>
      <F id="notes" label={t.common.notes} className="sm:col-span-2"><Textarea id="notes" name="notes" rows={2} defaultValue={w.notes ?? ""} dir="auto" /></F>
    </>
  );
}

const hhmm = (v?: string) => (!v ? "" : v.startsWith("24:") ? "00:00" : v.slice(0, 5));

export function ScheduleFields({
  t, shifts = [], daysOff = [], noDayOff = false, breakTime = null,
}: { t: Dict; shifts?: Shift[]; daysOff?: number[]; noDayOff?: boolean; breakTime?: string | null }) {
  const L = t.worker;
  const chip = "flex h-10 cursor-pointer items-center gap-2 rounded-full border border-input bg-surface px-3.5 text-sm font-medium transition-colors duration-150 has-[:checked]:border-primary has-[:checked]:bg-surface-tint has-[:checked]:text-accent-foreground";
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="grid grid-cols-2 gap-3 sm:col-span-2">
          <F id={`shift_start_${i}`} label={i === 0 ? L.shiftStart : L.secondStart}><Input id={`shift_start_${i}`} name="shift_start" type="time" defaultValue={hhmm(shifts[i]?.start)} /></F>
          <F id={`shift_end_${i}`} label={i === 0 ? L.shiftEnd : L.secondEnd}><Input id={`shift_end_${i}`} name="shift_end" type="time" defaultValue={hhmm(shifts[i]?.end)} /></F>
        </div>
      ))}
      <FieldDescription className="-mt-2 sm:col-span-2">{L.midnightHint}</FieldDescription>
      <FieldSet className="sm:col-span-2">
        <FieldLegend variant="label">{L.dayOff}</FieldLegend>
        <div className="flex flex-wrap gap-2">
          {t.weekdays.map((label, d) => (
            <label key={d} className={chip}>
              <input type="checkbox" name="days_off" value={d} defaultChecked={daysOff.includes(d)} className="accent-primary" />
              {label}
            </label>
          ))}
          <label className={`${chip} border-dashed has-[:checked]:border-warning has-[:checked]:bg-warning-soft has-[:checked]:text-warning`}>
            <input type="checkbox" name="no_day_off" defaultChecked={noDayOff} className="accent-warning" />
            {L.noDayOff}
          </label>
        </div>
      </FieldSet>
      <F id="break_time" label={L.breakTime}><Input id="break_time" name="break_time" type="time" defaultValue={hhmm(breakTime ?? undefined)} /></F>
    </>
  );
}
