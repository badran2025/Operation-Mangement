import { redirect } from "next/navigation";

/** Old address of a branch's diesel page: the main diesel page, filtered on the branch. */
export default async function BranchDieselPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const q = new URLSearchParams({ b: String(id) });
  for (const k of ["tab", "p", "m", "from", "to"]) if (sp[k]) q.set(k, sp[k]!);
  redirect(`/diesel?${q.toString()}`);
}
