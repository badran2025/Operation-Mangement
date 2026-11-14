import { daysUntil } from "@/lib/format";
import Link from "next/link";

export function PageHeader({
  title, subtitle, back, children,
}: { title: string; subtitle?: React.ReactNode; back?: { href: string; label: string }; children?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-brand-700 hover:underline">→ {back.label}</Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}

const TONES = {
  gray: "bg-slate-100 text-slate-600",
  green: "bg-brand-50 text-brand-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-800",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "amber" | "red" }) {
  const color = tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-10 text-center text-slate-500">{children}</div>;
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function ExpiryBadge({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <Badge>بدون تاريخ</Badge>;
  if (d < 0) return <Badge tone="red">منتهي من {-d} يوم</Badge>;
  if (d <= 30) return <Badge tone="red">باقي {d} يوم</Badge>;
  if (d <= 90) return <Badge tone="amber">باقي {d} يوم</Badge>;
  return <Badge tone="green">ساري · باقي {d} يوم</Badge>;
}

