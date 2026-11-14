"use client";

export function FilePicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  return (
    <div>
      <label className="btn-ghost cursor-pointer">
        📷 إضافة صور / فيديو
        <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden"
          onChange={(e) => { onChange([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              {f.name.slice(0, 24)}
              <button type="button" className="text-red-600" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label="حذف">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
