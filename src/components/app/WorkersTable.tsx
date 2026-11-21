import Link from "next/link";
import type { Dict } from "@/lib/i18n/dictionaries";
import { pick, type Locale } from "@/lib/i18n/config";
import { formatDaysOff, formatShifts } from "@/lib/i18n/format";
import type { WorkerRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Workers list: who, what role, when they work, day off, housing, status. `branchName` adds a Branch column. */
export function WorkersTable({ t, locale, workers, linkNames, branchName }: {
  t: Dict; locale: Locale; workers: WorkerRow[]; linkNames: boolean; branchName?: (id: number | null) => { id: number; name: string } | null;
}) {
  const C = t.branch.col;
  const heads = [C.name, ...(branchName ? [t.workersPage.branch] : []), C.job, C.shift, C.dayOff, C.housing, C.status];
  return (
    <div className="-mx-4 overflow-x-auto md:-mx-5">
      <Table className="min-w-max">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {heads.map((h, i) => <TableHead key={h} className={cn("h-10 text-[12.5px] font-semibold text-ink-muted", i === 0 && "ps-4 md:ps-5", i === heads.length - 1 && "pe-4 md:pe-5")}>{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {workers.map((w) => {
            const dayOffMissing = !w.no_day_off && w.days_off.length === 0;
            const b = branchName?.(w.branch_id);
            return (
              <TableRow key={w.id} className="border-hairline">
                <TableCell className="py-3 ps-4 md:ps-5">
                  {linkNames ? <Link href={`/workers/${w.id}`} className="font-semibold text-primary hover:underline" dir="auto">{w.full_name}</Link>
                    : <span className="font-semibold" dir="auto">{w.full_name}</span>}
                  {(w.alt_name || w.emp_no) && (
                    <div className="text-[12.5px] text-ink-muted">
                      {w.alt_name && <span dir="auto">{w.alt_name}</span>}
                      {w.alt_name && w.emp_no && <span className="mx-1.5 text-hairline" aria-hidden>|</span>}
                      {w.emp_no && <span dir="ltr" className="num">{w.emp_no}</span>}
                    </div>
                  )}
                </TableCell>
                {branchName && <TableCell>{b ? <Link href={`/branches/${b.id}`} className="hover:text-primary hover:underline">{b.name}</Link> : "—"}</TableCell>}
                <TableCell>{w.job_title_ar ? pick(locale, w.job_title_ar, w.job_title_en) : <span className="text-warning">{t.branch.notSetWarn}</span>}</TableCell>
                <TableCell className="whitespace-nowrap">{w.shifts.length ? formatShifts(t, w.shifts) : <span className="text-warning">{t.branch.notSetWarn}</span>}</TableCell>
                <TableCell>
                  <span className={cn(dayOffMissing && "text-warning")}>{dayOffMissing ? t.branch.notSetWarn : formatDaysOff(t, w.days_off, w.no_day_off)}</span>
                  {w.off_today && w.status === "active" && <Badge variant="warning" className="ms-2">{t.branch.offToday}</Badge>}
                </TableCell>
                <TableCell dir="auto">{w.housing_name ?? <span className="text-ink-muted">—</span>}</TableCell>
                <TableCell className="pe-4 md:pe-5">
                  <Badge variant={w.status === "active" ? "success" : w.status === "on_leave" ? "info" : "neutral"}>{t.worker.status[w.status]}</Badge>
                  {w.notes && <div className="mt-1 max-w-[220px] truncate text-[12.5px] text-ink-muted" dir="auto" title={w.notes}>{w.notes}</div>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
