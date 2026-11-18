/** Arabic-Indic / Persian digits and separators → plain "123.4". */
export function latinDigits(v: string): string {
  return v
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,،]/g, ".")
    .replace(/٬/g, "");
}

/** A number from what someone typed (any digits), or null when empty / not a number. */
export function parseNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = latinDigits(String(v)).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
