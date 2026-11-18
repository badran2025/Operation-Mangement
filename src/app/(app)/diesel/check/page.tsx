import { redirect } from "next/navigation";

/** Level readings are part of recording a delivery now; old links land there. */
export default async function CheckPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const { branch } = await searchParams;
  redirect(branch ? `/diesel/refuel?branch=${branch}` : "/diesel/refuel");
}
