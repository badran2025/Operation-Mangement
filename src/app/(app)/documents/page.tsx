import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { daysUntil, formatDate, nf } from "@/lib/i18n/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyNote, Kpi, PageHeader, Panel } from "@/components/app/blocks";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const n = nf(locale);
  const D = t.documents;
  const { data } = await supabase
    .from("worker_documents")
    .select("id, doc_type, expiry_date, worker_id, workers(full_name)")
    .not("expiry_date", "is", null)
    .order("expiry_date");
  const docs = (data ?? []).map((d) => ({ ...d, days: daysUntil(d.expiry_date)! }));
  const expired = docs.filter((d) => d.days < 0).length;
  const soon = docs.filter((d) => d.days >= 0 && d.days <= 30).length;
  const within90 = docs.filter((d) => d.days > 30 && d.days <= 90).length;
  const attention = docs.filter((d) => d.days <= 90);

  return (
    <>
      <PageHeader title={D.title} sub={D.sub} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={D.expired} value={n(expired)} tone={expired ? "danger" : undefined} />
        <Kpi label={D.within30} value={n(soon)} tone={soon ? "danger" : undefined} />
        <Kpi label={D.within90} value={n(within90)} tone={within90 ? "warning" : undefined} />
        <Kpi label={D.recorded} value={n(docs.length)} highlight />
      </section>
      <Panel>
        {attention.length === 0 ? <EmptyNote>{D.none}</EmptyNote> : (
          <div className="-mx-4 overflow-x-auto md:-mx-5">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {[D.col.worker, D.col.doc, D.col.expiry, D.col.state].map((h, i) => (
                    <TableHead key={h} className={i === 0 ? "h-10 ps-4 text-[12.5px] font-semibold text-ink-muted md:ps-5" : "h-10 text-[12.5px] font-semibold text-ink-muted"}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {attention.map((d) => (
                  <TableRow key={d.id} className="border-hairline">
                    <TableCell className="py-3 ps-4 md:ps-5">
                      <Link href={`/workers/${d.worker_id}`} className="font-semibold text-primary hover:underline" dir="auto">{(d.workers as unknown as { full_name: string } | null)?.full_name}</Link>
                    </TableCell>
                    <TableCell>{t.worker.docTypes[d.doc_type]}</TableCell>
                    <TableCell className="num">{formatDate(locale, d.expiry_date)}</TableCell>
                    <TableCell>
                      <Badge variant={d.days < 0 || d.days <= 30 ? "danger" : "warning"}>{d.days < 0 ? t.time.expiredDays(-d.days) : t.time.daysLeft(d.days)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}
