"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { NumberInput } from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { deleteSupplier, saveSupplier } from "./actions";

export type Supplier = { id: number; name: string; price_per_liter: number | null; active: boolean; deliveries: number };

function SupplierRow({ s }: { s?: Supplier }) {
  const { t } = useI18n();
  const S = t.diesel.sup;
  const router = useRouter();
  const [name, setName] = useState(s?.name ?? "");
  const [price, setPrice] = useState(s?.price_per_liter ? String(s.price_per_liter) : "");
  const [active, setActive] = useState(s?.active ?? true);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const changed = !s || name !== s.name || price !== (s.price_per_liter ? String(s.price_per_liter) : "") || active !== s.active;
  return (
    <li className="flex flex-wrap items-end gap-2 rounded-[14px] bg-canvas p-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-[12.5px] text-ink-muted">{S.name}<Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" /></label>
      <label className="flex w-36 flex-col gap-1 text-[12.5px] text-ink-muted">{S.price}<NumberInput value={price} onChange={(e) => setPrice(e.target.value)} placeholder={S.noPrice} /></label>
      {s && <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} />{S.inUse}</label>}
      {s && <span className="h-10 text-[12.5px] leading-10 text-ink-muted">{S.deliveries(String(s.deliveries))}</span>}
      <Button type="button" disabled={busy || !changed || !name.trim()} onClick={() => start(async () => {
        setMsg(null); const r = await saveSupplier(s?.id ?? null, { name, price, active });
        if (r.error) setMsg(r.error); else { if (!s) { setName(""); setPrice(""); } setMsg(S.saved); router.refresh(); }
      })}>{busy && <Spinner data-icon="inline-start" />}{s ? t.common.save : S.add}</Button>
      {s && (
        <Button type="button" variant="ghost" aria-label={S.delete} className="text-danger hover:bg-danger-soft hover:text-danger" disabled={busy}
          onClick={() => window.confirm(`${S.delete}?`) && start(async () => { const r = await deleteSupplier(s.id); if (r.error || r.notice) window.alert(r.error ?? r.notice); router.refresh(); })}>
          <Trash2Icon className="size-4" aria-hidden />
        </Button>
      )}
      {msg && <span role="status" className="basis-full text-[12.5px] font-semibold text-primary">{msg}</span>}
    </li>
  );
}

/** The suppliers and their agreed price per litre (admin). */
export function Suppliers({ list }: { list: Supplier[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {list.map((s) => <SupplierRow key={`${s.id}-${s.name}-${s.price_per_liter}-${s.active}`} s={s} />)}
      <SupplierRow />
    </ul>
  );
}
