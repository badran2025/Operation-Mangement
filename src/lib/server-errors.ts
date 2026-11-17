import "server-only";
import { getT } from "./i18n/server";

/** Map database / API error messages to the user's language. */
export async function friendlyError(message: string): Promise<string> {
  const { t } = await getT();
  const m = message.toLowerCase();
  if (m.includes("equipment_code_key")) return t.branchesTab.equipment.codeTaken;
  if (m.includes("branches_code_key")) return t.branchesTab.info.codeTaken;
  if (m.includes("branches_code_format")) return t.branchesTab.info.codeBad;
  if (m.includes("equipment not in branch")) return t.branchesTab.equipment.notInBranch;
  if (m.includes("plan cycle")) return t.errors.planCycle;
  if (m.includes("needs assignee")) return t.errors.needsAssignee;
  if (m.includes("note required")) return t.errors.noteRequired;
  if (m.includes("bad transition")) return t.errors.badTransition;
  if (m.includes("ticket is closed")) return t.errors.ticketClosed;
  if (m.includes("not allowed") || m.includes("مش مسموح") || m.includes("permission denied")) return t.errors.notAllowed;
  if (m.includes("العنوان مطلوب")) return t.errors.titleRequired;
  if (m.includes("مش موجود أو مش مفعّل")) return t.errors.userInactive;
  if (m.includes("صلاحية الأدمن عن نفسك")) return t.errors.selfAdmin;
  return t.errors.generic(message);
}
