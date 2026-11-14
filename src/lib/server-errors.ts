import "server-only";
import { getT } from "./i18n/server";

/** Map database / API error messages to the user's language. */
export async function friendlyError(message: string): Promise<string> {
  const { t } = await getT();
  const m = message.toLowerCase();
  if (m.includes("not allowed") || m.includes("مش مسموح") || m.includes("permission denied")) return t.errors.notAllowed;
  if (m.includes("العنوان مطلوب")) return t.errors.titleRequired;
  if (m.includes("مش موجود أو مش مفعّل")) return t.errors.userInactive;
  if (m.includes("صلاحية الأدمن عن نفسك")) return t.errors.selfAdmin;
  return t.errors.generic(message);
}
