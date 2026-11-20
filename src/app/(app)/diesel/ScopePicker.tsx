"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPinIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";

type City = { id: number; name: string; branches: { id: number; name: string }[] };
/** All branches, one city, or one branch: kept across the tabs and the period. */
export function ScopePicker({ cities, value }: { cities: City[]; value: string }) {
  const { t } = useI18n();
  const S = t.diesel.scope;
  const router = useRouter();
  const sp = useSearchParams();
  const go = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    q.delete("b"); q.delete("c"); q.delete("saved");
    if (v.startsWith("b:")) q.set("b", v.slice(2));
    if (v.startsWith("c:")) q.set("c", v.slice(2));
    if (q.get("tab") === "suppliers") q.delete("tab");
    router.push(`/diesel${q.toString() ? `?${q}` : ""}`);
  };
  return (
    <label className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface p-3">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted"><MapPinIcon className="size-4" aria-hidden />{S.label}</span>
      <NativeSelect value={value} onChange={(e) => go(e.target.value)} className="min-w-64 flex-1 sm:flex-none" aria-label={S.label}>
        <NativeSelectOption value="">{S.all}</NativeSelectOption>
        <NativeSelectOptGroup label={S.cities}>
          {cities.map((c) => <NativeSelectOption key={c.id} value={`c:${c.id}`}>{S.city(c.name)}</NativeSelectOption>)}
        </NativeSelectOptGroup>
        {cities.map((c) => (
          <NativeSelectOptGroup key={c.id} label={c.name}>
            {c.branches.map((b) => <NativeSelectOption key={b.id} value={`b:${b.id}`}>{b.name}</NativeSelectOption>)}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
    </label>
  );
}
