import Link from "next/link";
import { ImageIcon, PencilIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DeleteRefuel } from "./DeleteRefuel";

export type Refuel = {
  id: number; branch_id: number; refuel_date: string; liters: number; received_liters: number | null; shortage_liters: number | null;
  before_liters: number | null; after_liters: number | null; total_amount: number | null;
  supplier: string | null; supplier_id?: number | null; price_per_liter: number | null; invoice_no: string | null; notes: string | null;
  profiles: { full_name: string } | null; diesel_refuel_files: { file_path: string }[];
};

/** Every delivery with the full picture: before, filled, after, invoice litres, difference, total, price per litre. */
export function DeliveriesTable({ t, locale, refuels, branchName, photoUrl, canDelete, canEdit = true, supplierPrice = {} }: {
  t: Dict; locale: Locale; refuels: Refuel[]; branchName?: (id: number) => string | undefined;
  photoUrl: (path: string) => string | undefined; canDelete: boolean; canEdit?: boolean; supplierPrice?: Record<number, number>;
}) {
  const D = t.diesel;
  const one = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en", { maximumFractionDigits: 1 });
  const L = (v: number | null | undefined) => (v === null || v === undefined ? "—" : one.format(Number(v)));
  const heads = [D.col.date, ...(branchName ? [D.table.branch] : []), D.col.before, D.col.received, D.col.after, D.col.ordered, D.col.diff, D.col.cost, D.col.perL, D.col.supplier, D.col.by, D.files, ""];
  return (
    <div className="-mx-4 overflow-x-auto md:-mx-5">
      <table className="w-full min-w-[1080px] text-sm">
        <thead>
          <tr className="text-[12.5px] text-ink-muted">
            {heads.map((h, i) => <th key={i} className={cn("h-10 px-3 text-start font-semibold", i === 0 && "ps-4 md:ps-5")}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {refuels.map((r) => {
            const diff = r.received_liters !== null ? Math.round((Number(r.received_liters) - Number(r.liters)) * 10) / 10 : null;
            return (
              <tr key={r.id} className="border-t border-hairline align-top">
                <td className="num py-3 ps-4 pe-3 whitespace-nowrap md:ps-5">{formatDate(locale, r.refuel_date)}</td>
                {branchName && <td className="px-3 py-3 font-medium">{branchName(r.branch_id) ?? "—"}</td>}
                <td className="num px-3 py-3 text-ink-muted">{L(r.before_liters)}</td>
                <td className="num px-3 py-3 font-semibold text-primary">{r.received_liters !== null ? `+${L(r.received_liters)}` : "—"}</td>
                <td className="num px-3 py-3 text-ink-muted">{L(r.after_liters)}</td>
                <td className="num px-3 py-3 font-semibold">{L(r.liters)}</td>
                <td className="px-3 py-3">{diff === null ? "—" : diff < 0 ? <Badge variant="danger">{D.shortageL(L(-diff))}</Badge> : <Badge variant="success">{diff > 0 ? `+${L(diff)}` : D.ok}</Badge>}</td>
                {(() => {
                  // no invoice total: the supplier's agreed price
                  const sp = r.total_amount === null && r.supplier_id ? supplierPrice[r.supplier_id] : undefined;
                  return <>
                    <td className="num px-3 py-3">{r.total_amount !== null ? L(r.total_amount) : sp ? <span title={D.sup.priceFromSupplier}>{L(Number(r.liters) * sp)}<span className="block text-[11px] text-ink-muted">{D.sup.priceFromSupplier}</span></span> : "—"}</td>
                    <td className="num px-3 py-3">{r.price_per_liter !== null ? new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(Number(r.price_per_liter)) : sp ? new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(sp) : "—"}</td>
                  </>;
                })()}
                <td className="px-3 py-3" dir="auto">{r.supplier ?? "—"}{r.invoice_no && <span className="num block text-[12px] text-ink-muted" dir="ltr">{r.invoice_no}</span>}</td>
                <td className="px-3 py-3" dir="auto">{r.profiles?.full_name ?? "—"}</td>
                <td className="px-3 py-3">
                  <span className="flex gap-1.5">
                    {r.diesel_refuel_files.map((f, i) => {
                      const u = photoUrl(f.file_path);
                      return u ? (
                        <a key={i} href={u} target="_blank" rel="noreferrer" className="inline-flex size-8 items-center justify-center rounded-lg bg-canvas text-primary hover:bg-surface-sunken" aria-label={`${D.files} ${i + 1}`}>
                          <ImageIcon className="size-4" aria-hidden />
                        </a>
                      ) : null;
                    })}
                  </span>
                </td>
                <td className="px-3 py-3"><span className="flex gap-1">
                  {canEdit && <Link href={`/diesel/refuel/${r.id}`} aria-label={D.form.edit} title={D.form.edit} className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-tint hover:text-primary"><PencilIcon className="size-4" aria-hidden /></Link>}
                  {canDelete && <DeleteRefuel id={r.id} />}
                </span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
