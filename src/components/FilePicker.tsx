"use client";
import { CameraIcon, XIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

export function FilePicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <label className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-full border border-input bg-surface px-4 text-sm font-semibold transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
        <CameraIcon className="size-4" aria-hidden />
        {t.maintenance.addFiles}
        <input type="file" multiple accept="image/*,video/*,application/pdf" className="sr-only"
          onChange={(e) => { onChange([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
      </label>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-1 rounded-full bg-surface-sunken py-1 ps-3 pe-1">
              <span dir="auto" className="max-w-[180px] truncate">{f.name}</span>
              <button type="button" className="grid size-6 place-items-center rounded-full text-danger hover:bg-danger-soft" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`${t.common.delete} ${f.name}`}>
                <XIcon className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
